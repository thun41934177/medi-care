import type { Lang } from "../i18n";

const LOCALE: Record<Lang, string> = { en: "en-US", th: "th-TH" };
const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;

/* ---------------- voices ---------------- */
let cache: SpeechSynthesisVoice[] = [];
const listeners = new Set<() => void>();
function loadVoices() {
  cache = synth?.getVoices() ?? [];
  listeners.forEach((l) => l());
  return cache;
}
if (synth) {
  loadVoices();
  synth.addEventListener?.("voiceschanged", loadVoices);
}
/** Call cb when the device finishes loading its voices. Returns an unsubscribe function. */
export function onVoicesChanged(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

const norm = (s: string) => s.toLowerCase().replace("_", "-");
export function voicesFor(lang: Lang): SpeechSynthesisVoice[] {
  const all = cache.length ? cache : loadVoices();
  return all.filter((v) => norm(v.lang).startsWith(lang));
}

const NATURAL = /premium|enhanced|neural|natural|siri|google|online|wavenet/i;
const ROBOTIC = /compact|novelty|eloquence|whisper|zarvox|trinoids|cellos|bells|boing|bubbles|deranged|good news|hysterical|pipe organ|bad news|albert|junior|ralph|fred|bruce|kathy|organ/i;
const FAVORITES: Record<Lang, string[]> = {
  en: ["Samantha", "Ava", "Allison", "Susan", "Serena", "Karen", "Moira", "Daniel", "Google US English"],
  th: ["Kanya", "Narisa", "Premwadee", "Google ไทย"],
};
function score(v: SpeechSynthesisVoice, lang: Lang) {
  let s = 0;
  if (NATURAL.test(v.name)) s += 10;
  if (/premium/i.test(v.name)) s += 5;
  if (ROBOTIC.test(v.name)) s -= 30;
  const fav = FAVORITES[lang].findIndex((n) => v.name.includes(n));
  if (fav >= 0) s += 8 - Math.min(fav, 7);
  if (norm(v.lang) === (lang === "en" ? "en-us" : "th-th")) s += 2;
  return s;
}

const key = (lang: Lang) => `voice-${lang}`;
export const getVoicePref = (lang: Lang) => { try { return localStorage.getItem(key(lang)) || ""; } catch { return ""; } };
export const setVoicePref = (lang: Lang, uri: string) => { try { uri ? localStorage.setItem(key(lang), uri) : localStorage.removeItem(key(lang)); } catch { /* ignore */ } };
export const getRate = () => { try { return Number(localStorage.getItem("voice-rate")) || 0.92; } catch { return 0.92; } };
export const setRate = (r: number) => { try { localStorage.setItem("voice-rate", String(r)); } catch { /* ignore */ } };

export function pickVoice(lang: Lang): SpeechSynthesisVoice | null {
  const vs = voicesFor(lang);
  const pref = getVoicePref(lang);
  const chosen = pref ? vs.find((v) => v.voiceURI === pref) : undefined;
  return chosen ?? [...vs].sort((a, b) => score(b, lang) - score(a, lang))[0] ?? null;
}

function utter(text: string, lang: Lang) {
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(lang);
  u.lang = v?.lang || LOCALE[lang];
  if (v) u.voice = v;
  u.rate = getRate();
  u.pitch = 1;
  u.volume = 1;
  return u;
}

/* iPad/Safari only allow speech after a tap: "unlock" it silently on the first touch */
if (synth && typeof window !== "undefined") {
  const unlock = () => {
    try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; synth.speak(u); } catch { /* ignore */ }
    window.removeEventListener("pointerdown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
}

/* ---------------- speaking ---------------- */
/** Removes markdown and emoji so the voice does not read symbols aloud. */
export const cleanForSpeech = (s: string) =>
  s.replace(/[*_`#>~]+/g, "").replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim();

/** Splits long text into short pieces (browsers cut off long utterances). */
function splitForSpeech(text: string): string[] {
  const out: string[] = [];
  const sentences = text.match(/[^.!?。！？\n]+[.!?。！？]*\s*/g) ?? [text];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > 170 && cur) { out.push(cur.trim()); cur = ""; }
    cur += s;
    while (cur.length > 220) {                       // Thai has no full stops: cut at a space
      const i = cur.lastIndexOf(" ", 200);
      if (i < 40) break;
      out.push(cur.slice(0, i).trim());
      cur = cur.slice(i + 1);
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

let token = 0;
export const isSpeaking = () => !!synth?.speaking;
export function stopSpeaking() { token++; synth?.cancel(); }

/** Speaks the text (replacing anything already speaking). onDone runs after the last word, not when interrupted. */
export function speak(text: string, lang: Lang, onDone?: () => void) {
  const clean = cleanForSpeech(text);
  if (!synth || !clean) { onDone?.(); return; }
  const my = ++token;
  synth.cancel();
  const chunks = splitForSpeech(clean);
  const next = (i: number) => {
    if (my !== token) return;
    if (i >= chunks.length) { onDone?.(); return; }
    const u = utter(chunks[i], lang);
    u.onend = () => next(i + 1);
    u.onerror = (e) => { if (e.error === "interrupted" || e.error === "canceled") return; next(i + 1); };
    synth.speak(u);
  };
  setTimeout(() => next(0), 60); // lets cancel() finish (Chrome drops speech started right after cancel)
}

/** Speaks one chunk WITHOUT cutting off what is already speaking (chunks queue up). */
export function speakChunk(text: string, lang: Lang, onDone: () => void) {
  if (!synth) { onDone(); return; }
  const u = utter(text, lang);
  u.onend = onDone;
  u.onerror = onDone;
  synth.speak(u);
}

/* ---------------- listening ---------------- */
export const canListen = () => !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

/** Starts one listening turn. Returns the recognizer so it can be aborted. onEnd(gotText, error). */
export function listen(lang: Lang, onText: (t: string) => void, onEnd: (gotText: boolean, error?: string) => void, onInterim?: (t: string) => void) {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) { onEnd(false, "unsupported"); return null; }
  const r = new SR();
  let got = false, err: string | undefined, finished = false;
  const finish = () => { if (!finished) { finished = true; onEnd(got, err); } };
  r.lang = LOCALE[lang];
  r.interimResults = !!onInterim;
  r.continuous = false;
  r.onresult = (e: any) => {
    const res = e.results[e.results.length - 1];
    if (res.isFinal) { got = true; onText(res[0].transcript); }
    else onInterim?.(res[0].transcript);
  };
  r.onerror = (e: any) => { err = e.error; };
  r.onend = finish;
  try { r.start(); } catch { finish(); }
  return r as { abort: () => void };
}

const EMERGENCY = /\b(help|fell|fallen|fall down|chest pain|can't breathe|cannot breathe|emergency|bleeding)\b|ช่วยด้วย|ล้ม|เจ็บหน้าอก|หายใจไม่ออก|เลือดออก/i;
export const looksLikeEmergency = (t: string) => EMERGENCY.test(t);
