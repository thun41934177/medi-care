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

/* ---------------- computer voice (server) ---------------- */
type Engine = "auto" | "server" | "browser";
export const getEngine = (): Engine => { try { return (localStorage.getItem("voice-engine") as Engine) || "auto"; } catch { return "auto"; } };
export const setEngine = (e: Engine) => { try { localStorage.setItem("voice-engine", e); } catch { /* ignore */ } };

export interface ServerVoices { available: boolean; voices: { th: string | null; en: string | null } }
let serverInfo: ServerVoices | null = null;
let serverBroken = false;
fetch("/api/tts/status").then((r) => r.json()).then((d) => { serverInfo = d; listeners.forEach((l) => l()); }).catch(() => { /* no server voice */ });
export const getServerVoices = () => serverInfo;

/** Use the computer's voice (Kanya for Thai, etc.) when it exists and the browser has no good voice for the language. */
function useServer(lang: Lang) {
  if (serverBroken || !serverInfo?.available || !serverInfo.voices[lang]) return false;
  const e = getEngine();
  if (e === "server") return true;
  if (e === "browser") return false;
  return lang === "th" || voicesFor(lang).length === 0;
}

const audio = typeof Audio !== "undefined" ? new Audio() : null;
let stopCurrent: (() => void) | null = null;

// iPad/Safari: unlock audio playback with the first tap
if (audio && typeof window !== "undefined") {
  const unlockAudio = () => {
    audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    audio.play().catch(() => { /* ignore */ });
    window.removeEventListener("pointerdown", unlockAudio);
  };
  window.addEventListener("pointerdown", unlockAudio);
}

async function fetchAudio(text: string, lang: Lang): Promise<string> {
  const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang, rate: getRate() }) });
  if (!r.ok) throw new Error("tts failed");
  return URL.createObjectURL(await r.blob());
}

/** Plays one audio URL. Resolves true when it finished, false when it was stopped or failed. */
function playUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!audio) return resolve(false);
    const done = (ok: boolean) => { audio.onended = null; audio.onerror = null; stopCurrent = null; URL.revokeObjectURL(url); resolve(ok); };
    stopCurrent = () => { audio.pause(); done(false); };
    audio.onended = () => done(true);
    audio.onerror = () => done(false);
    audio.src = url;
    audio.playbackRate = 1;
    audio.play().catch(() => done(false));
  });
}

/* ---------------- speaking ---------------- */
/** Removes markdown, emoji and mixed Thai endings so the voice does not read symbols aloud. */
export const cleanForSpeech = (s: string) =>
  s.replace(/[*_`#>~]+/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/(?:ครับ|คับ)\s*\/\s*(ค่ะ|คะ)/g, "$1")
    .replace(/(ค่ะ|คะ)\s*\/\s*(?:ครับ|คับ)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

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
let queue: Promise<unknown> = Promise.resolve();
export const isSpeaking = () => !!synth?.speaking || (!!audio && !audio.paused && !audio.ended);
export function stopSpeaking() { token++; synth?.cancel(); stopCurrent?.(); }

/** Speaks the text (replacing anything already speaking). onDone runs after the last word, not when interrupted. */
export function speak(text: string, lang: Lang, onDone?: () => void) {
  const clean = cleanForSpeech(text);
  if (!clean) { onDone?.(); return; }
  const my = ++token;
  synth?.cancel();
  stopCurrent?.();
  const chunks = splitForSpeech(clean);

  const browser = () => {
    if (!synth) { onDone?.(); return; }
    const next = (i: number) => {
      if (my !== token) return;
      if (i >= chunks.length) { onDone?.(); return; }
      const u = utter(chunks[i], lang);
      u.onend = () => next(i + 1);
      u.onerror = (e) => { if (e.error === "interrupted" || e.error === "canceled") return; next(i + 1); };
      synth.speak(u);
    };
    setTimeout(() => next(0), 60); // lets cancel() finish (Chrome drops speech started right after cancel)
  };

  if (!useServer(lang)) return browser();

  (async () => {
    let pending = fetchAudio(chunks[0], lang);
    for (let i = 0; i < chunks.length; i++) {
      const upcoming = i + 1 < chunks.length ? fetchAudio(chunks[i + 1], lang) : null; // prepare the next piece while this one plays
      let url: string;
      try { url = await pending; } catch { serverBroken = true; if (my === token) browser(); return; }
      if (my !== token) { URL.revokeObjectURL(url); return; }
      const ok = await playUrl(url);
      if (my !== token) return;
      if (!ok) { serverBroken = true; browser(); return; }
      pending = upcoming ?? pending;
    }
    if (my === token) onDone?.();
  })();
}

/** Speaks one chunk WITHOUT cutting off what is already speaking (chunks queue up). */
export function speakChunk(text: string, lang: Lang, onDone: () => void) {
  if (useServer(lang)) {
    const gen = token;
    const ready = fetchAudio(text, lang).catch(() => null);
    queue = queue.then(async () => {
      const url = await ready;
      if (gen !== token) { if (url) URL.revokeObjectURL(url); return; }
      if (!url) { onDone(); return; }
      await playUrl(url);
      if (gen === token) onDone();
    });
    return;
  }
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
