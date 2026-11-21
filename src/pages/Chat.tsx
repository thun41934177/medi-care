import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../store";
import { speak, stopSpeaking, listen, canListen, looksLikeEmergency } from "../lib/speech";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import Empty from "../components/Empty";

interface Msg { role: "user" | "assistant"; content: string }

export default function Chat() {
  const { t, lang, provider, autoSpeak, set } = useApp();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState(false); // hands-free conversation mode
  const [hearing, setHearing] = useState(false);
  const [micError, setMicError] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const voiceRef = useRef(false);
  const busyRef = useRef(false);
  const msgsRef = useRef<Msg[]>([]);
  const rec = useRef<{ abort: () => void } | null>(null);
  const silent = useRef(0); // consecutive silent turns

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs, busy]);
  useEffect(() => () => { voiceRef.current = false; rec.current?.abort(); stopSpeaking(); }, []);

  function startListen() {
    if (!voiceRef.current || busyRef.current) return;
    setHearing(true);
    rec.current = listen(
      lang,
      (txt) => { silent.current = 0; send(txt); },
      (got, err) => {
        setHearing(false);
        if (err === "not-allowed" || err === "service-not-allowed" || err === "unsupported") {
          setMicError(true);
          stopVoice();
          return;
        }
        if (!got && voiceRef.current && !busyRef.current) {
          silent.current += 1;
          if (silent.current >= 6) { stopVoice(); return; } // nobody is talking: stop after ~6 quiet turns
          setTimeout(startListen, 400);
        }
      }
    );
  }

  function startVoice() {
    setMicError(false);
    voiceRef.current = true;
    silent.current = 0;
    setVoice(true);
    speak(t("speakNow"), lang, startListen);
  }
  function stopVoice() {
    voiceRef.current = false;
    setVoice(false);
    setHearing(false);
    rec.current?.abort();
    stopSpeaking();
  }

  async function send(content: string) {
    content = content.trim();
    if (!content || busyRef.current) return;
    if (looksLikeEmergency(content)) { setEmergency(true); speak(t("needHelpPrompt"), lang); }
    const next: Msg[] = [...msgsRef.current, { role: "user", content }];
    msgsRef.current = next;
    setMsgs(next);
    setText("");
    busyRef.current = true;
    setBusy(true);
    let reply = t("aiError");
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, provider, lang }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      reply = data.reply;
      fetch("/api/robot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "face", emotion: "happy" }) }).catch(() => {});
    } catch { /* keep aiError text */ }
    const done = [...next, { role: "assistant" as const, content: reply }];
    msgsRef.current = done;
    setMsgs(done);
    busyRef.current = false;
    setBusy(false);
    // speak the reply, then listen again (the conversation loop)
    if (voiceRef.current || autoSpeak) speak(reply, lang, () => { if (voiceRef.current) setTimeout(startListen, 300); });
    else if (voiceRef.current) setTimeout(startListen, 300);
  }

  const status = hearing ? t("listening") : busy ? t("thinking") : voice ? <><Icon name="volume" size={20} /> …</> : null;

  return (
    <div className="page">
      <PageHeader icon="chat" title={t("talk")} sub={t("chatSub")} />
      <Link to="/live"><button className="primary" style={{ width: "100%", marginBottom: ".8rem", minHeight: "4rem", fontSize: "1.15rem" }}><Icon name="phone" size={24} /> {t("callAi")}</button></Link>
      {emergency && (
        <Link to="/sos"><button className="danger" style={{ width: "100%", marginBottom: ".8rem", minHeight: "4rem" }}><Icon name="alert" /> {t("needHelpPrompt")}</button></Link>
      )}

      {canListen() && (
        <div className="orb-wrap">
          <button className={`orb${voice ? " on" : ""}`} onClick={voice ? stopVoice : startVoice} aria-label={voice ? t("voiceOff") : t("voiceOn")}>
            <Icon name={voice ? "stop" : "mic"} size={64} stroke={2} />
          </button>
          <div className="orb-label">{voice ? t("voiceOff") : t("voiceOn")}</div>
          {status && <div className="status">{status}</div>}
        </div>
      )}
      {(micError || !canListen()) && <p className="msg-bad">{t("micBlocked")}</p>}

      <div className="chat">
        {msgs.length === 0 && <Empty icon="chat" title={t("chatEmpty")} />}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="who">{m.role === "assistant" ? t("assistantLabel") : t("youLabel")}</div>
            <div className={`bubble ${m.role}`}>
              {m.content}
              {m.role === "assistant" && (
                <button className="speak-btn" onClick={() => speak(m.content, lang)} aria-label={t("speakIt")}><Icon name="volume" size={18} /> {t("speakIt")}</button>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="msg assistant"><div className="who">{t("assistantLabel")}</div><div className="bubble assistant">{t("thinking")}…</div></div>
        )}
        <div ref={end} />
      </div>

      <label className="check" style={{ margin: "0 0 .6rem" }}>
        <input type="checkbox" checked={autoSpeak} onChange={(e) => set({ autoSpeak: e.target.checked })} />
        <span>{t("readAloud")}</span>
      </label>
      <div className="composer">
        <input
          className="grow"
          value={text}
          placeholder={t("typeHere")}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(text)}
        />
        <button className="primary icon-btn" onClick={() => send(text)} disabled={busy} aria-label={t("send")}><Icon name="send" size={22} /></button>
      </div>
    </div>
  );
}
