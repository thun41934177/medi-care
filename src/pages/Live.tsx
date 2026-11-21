import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../store";
import { speakChunk, cleanForSpeech, listen, canListen, looksLikeEmergency, stopSpeaking } from "../lib/speech";
import { streamChat } from "../lib/chatStream";
import Icon from "../components/Icon";

type Phase = "idle" | "listening" | "thinking" | "speaking";
interface Msg { role: "user" | "assistant"; content: string }

const robot = (emotion: string) =>
  fetch("/api/robot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "face", emotion }) }).catch(() => {});

export default function Live() {
  const { t, lang, provider } = useApp();
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>("idle");
  const [userCap, setUserCap] = useState("");
  const [aiCap, setAiCap] = useState("");
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [micError, setMicError] = useState(false);
  const [emergency, setEmergency] = useState(false);

  const active = useRef(true);
  const mutedRef = useRef(false);
  const gen = useRef(0); // bumps whenever a turn is interrupted, so stale callbacks do nothing
  const history = useRef<Msg[]>([]);
  const rec = useRef<{ abort: () => void } | null>(null);
  const ac = useRef<AbortController | null>(null);
  const pending = useRef(0);
  const streamDone = useRef(false);
  const buffer = useRef("");
  const silent = useRef(0);
  const speaking = useRef(false);

  useEffect(() => {
    active.current = true;
    if (!canListen()) { setMicError(true); return; }
    // friendly greeting, then start listening
    const g = ++gen.current;
    setPhase("speaking");
    speakChunk(t("liveHello"), lang, () => { if (gen.current === g) listenTurn(); });
    return () => {
      active.current = false;
      gen.current++;
      ac.current?.abort();
      rec.current?.abort();
      stopSpeaking();
      robot("neutral");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function listenTurn() {
    if (!active.current || mutedRef.current) { setPhase("idle"); return; }
    const g = gen.current;
    setPhase("listening");
    setUserCap("");
    rec.current = listen(
      lang,
      (txt) => { if (gen.current === g) { silent.current = 0; handleUser(txt); } },
      (got, err) => {
        if (gen.current !== g || !active.current) return;
        if (err === "not-allowed" || err === "service-not-allowed" || err === "unsupported") { setMicError(true); setPhase("idle"); return; }
        if (got) return; // handleUser took over
        silent.current += 1;
        if (silent.current >= 6) { setPaused(true); setPhase("idle"); return; } // nobody is talking
        setTimeout(() => { if (gen.current === g && active.current) listenTurn(); }, 250);
      },
      (interim) => { if (gen.current === g) setUserCap(interim); }
    );
  }

  function enqueue(chunk: string, g: number) {
    const text = cleanForSpeech(chunk);
    if (!text) return;
    pending.current += 1;
    if (!speaking.current) { speaking.current = true; setPhase("speaking"); robot("happy"); }
    speakChunk(text, lang, () => {
      if (gen.current !== g) return;
      pending.current -= 1;
      maybeFinish(g);
    });
  }

  function maybeFinish(g: number) {
    if (pending.current === 0 && streamDone.current && gen.current === g && active.current) {
      speaking.current = false;
      robot("neutral");
      setTimeout(() => { if (gen.current === g) listenTurn(); }, 250);
    }
  }

  function flush(final: boolean, g: number) {
    for (;;) {
      const m = /[.!?。！？]+(\s+|$)|\n+/.exec(buffer.current);
      let cut = -1;
      if (m) cut = m.index + m[0].length;
      else if (buffer.current.length > 70) {
        const i = buffer.current.indexOf(" ", 50); // Thai has no full stops: cut at a space
        if (i > 0) cut = i + 1;
      }
      if (cut < 0) break;
      enqueue(buffer.current.slice(0, cut), g);
      buffer.current = buffer.current.slice(cut);
    }
    if (final && buffer.current.trim()) { enqueue(buffer.current, g); buffer.current = ""; }
  }

  async function handleUser(text: string) {
    text = text.trim();
    if (!text) return listenTurn();
    if (looksLikeEmergency(text)) setEmergency(true);
    const g = ++gen.current;
    setUserCap(text);
    setAiCap("");
    setPhase("thinking");
    history.current = [...history.current, { role: "user", content: text }];
    buffer.current = "";
    pending.current = 0;
    streamDone.current = false;
    speaking.current = false;
    ac.current = new AbortController();
    let full = "";
    try {
      await streamChat(
        { messages: history.current, provider, lang, mode: "live" },
        (d) => { if (gen.current !== g) return; full += d; setAiCap(full); buffer.current += d; flush(false, g); },
        ac.current.signal
      );
    } catch {
      if (gen.current !== g) return; // interrupted on purpose
      if (!full) { full = t("aiError"); setAiCap(full); buffer.current = full; }
    }
    if (gen.current !== g) return;
    flush(true, g);
    streamDone.current = true;
    history.current = [...history.current, { role: "assistant", content: full }];
    maybeFinish(g);
  }

  /** Tap the orb: stop the AI talking and let the elder speak (like interrupting a person). */
  function interrupt() {
    if (!active.current) return;
    gen.current++;
    ac.current?.abort();
    rec.current?.abort();
    stopSpeaking();
    pending.current = 0;
    speaking.current = false;
    setPaused(false);
    silent.current = 0;
    listenTurn();
  }

  function toggleMute() {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    if (mutedRef.current) { gen.current++; rec.current?.abort(); setPhase("idle"); }
    else interrupt();
  }

  function endCall() { nav("/home"); }

  const label =
    micError ? t("micBlocked")
    : paused ? t("liveResume")
    : muted ? t("muted")
    : phase === "listening" ? t("listening")
    : phase === "thinking" ? t("thinking")
    : phase === "speaking" ? t("liveTapInterrupt")
    : "";

  return (
    <div className="live">
      <div className="live-top">
        <span className="live-badge"><i /> {t("voiceConversation")}</span>
        {emergency && <Link to="/sos"><button className="danger small"><Icon name="alert" size={18} /> {t("sos")}</button></Link>}
      </div>

      <div className="live-center">
        <button className={`live-orb ${paused || muted ? "idle" : phase}`} onClick={paused || phase === "speaking" || phase === "idle" ? interrupt : undefined} aria-label={label}>
          <span className="live-glow" />
          <span className="live-core"><Icon name={phase === "speaking" ? "volume" : phase === "thinking" ? "clock" : "mic"} size={56} stroke={1.8} /></span>
        </button>
        <div className="live-label">{label}</div>
      </div>

      <div className="live-caps">
        {userCap && <div className="cap"><small>{t("youLabel")}</small><p>{userCap}</p></div>}
        {aiCap && <div className="cap ai"><small>{t("assistantLabel")}</small><p>{aiCap}</p></div>}
      </div>

      <div className="live-controls">
        <button className={`live-btn ${muted ? "on" : ""}`} onClick={toggleMute} aria-label={muted ? t("unmute") : t("mute")}>
          <Icon name={muted ? "micOff" : "mic"} size={30} />
        </button>
        <button className="live-btn end" onClick={endCall} aria-label={t("endCall")}>
          <Icon name="phone" size={34} />
        </button>
        <Link to="/chat"><button className="live-btn" aria-label={t("talk")}><Icon name="chat" size={30} /></button></Link>
      </div>
      <div className="live-hint">{t("endCall")}</div>
    </div>
  );
}
