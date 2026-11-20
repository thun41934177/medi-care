import { useEffect, useRef, useState } from "react";
import { useRoom } from "../lib/room";
import { useApp } from "../store";
import { listen, canListen } from "../lib/speech";
import Icon from "./Icon";
import Empty from "./Empty";
import type { Key } from "../i18n";

const QUICK: Key[] = ["qLove", "qOk", "qThanks", "qCall"];

/** Online people + message thread + composer. Used by the resident page and the family join page. */
export default function RoomView({ me, aside }: { me: "resident" | "family"; aside?: React.ReactNode }) {
  const { t, lang } = useApp();
  const { status, peers, myId, known, messages, sendChat, call, callError, markRead } = useRoom();
  const [text, setText] = useState("");
  const [hearing, setHearing] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { markRead(); end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const others = peers.filter((p) => p.id !== myId);
  const offline = me === "resident" ? known.filter((k) => !others.some((p) => p.name === k)) : [];
  const target = me === "resident" ? "family" : "resident";

  function submit(v = text) {
    v = v.trim();
    if (!v || status !== "online") return;
    sendChat(v);
    setText("");
  }
  function dictate() {
    if (hearing) return;
    setHearing(true);
    listen(lang, (txt) => submit(txt), () => setHearing(false));
  }

  return (
    <div className="roomview">
      <div className="rv-side">
      {aside}
      <div className="card">
        <h2><span className={`dot ${status === "online" ? "ok" : "bad"}`} /> {t(me === "resident" ? "familyOnline" : "residentOnline")}</h2>
        {status !== "online" && <p className="muted">{t("connecting")}</p>}
        {status === "online" && others.length === 0 && <p className="muted">{t(me === "resident" ? "nobodyOnline" : "residentOffline")}</p>}
        {others.map((p) => (
          <div key={p.id} className="peer-row">
            <span className="peer-avatar">{p.name.slice(0, 1).toUpperCase()}</span>
            <div className="grow"><b>{p.name}</b><div className="muted">{p.role === "family" ? t("familyMember") : t("resident")}</div></div>
            {p.role === target && <button className="good" onClick={() => call(p)}><Icon name="video" size={24} /> {t("videoCall")}</button>}
          </div>
        ))}
        {offline.map((k) => (
          <div key={k} className="peer-row off"><span className="peer-avatar">{k.slice(0, 1).toUpperCase()}</span><div className="grow"><b>{k}</b><div className="muted">{t("offline")}</div></div></div>
        ))}
        {callError && <p className="msg-bad">{callError === "https" ? t("needHttps") : t("cameraBlocked")}</p>}
      </div>

      </div>
      <div className="rv-main">
      <div className="chat" style={{ marginTop: "1rem" }}>
        {messages.length === 0 && <Empty icon="chat" title={t("noMessages")} />}
        {messages.map((m) => {
          const mine = m.role === me;
          return (
            <div key={m.id} className={`msg ${mine ? "user" : "assistant"}`}>
              <span className="avatar">{m.from.slice(0, 1).toUpperCase()}</span>
              <div className={`bubble ${mine ? "user" : "assistant"}`}>
                {!mine && <div className="muted" style={{ fontWeight: 800 }}>{m.from}</div>}
                {m.text}
                <div className="stamp">{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      <div className="row" style={{ marginBottom: ".6rem" }}>
        {QUICK.map((q) => <button key={q} className="small" onClick={() => submit(t(q))}>{t(q)}</button>)}
      </div>
      <div className="composer">
        {me === "resident" && canListen() && (
          <button className={hearing ? "danger icon-btn" : "good icon-btn"} onClick={dictate} aria-label={t("voiceOn")}><Icon name="mic" size={24} /></button>
        )}
        <input className="grow" value={text} placeholder={t("typeHere")} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <button className="primary icon-btn" onClick={() => submit()} aria-label={t("send")}><Icon name="send" size={22} /></button>
      </div>
      </div>
    </div>
  );
}
