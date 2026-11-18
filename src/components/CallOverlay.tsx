import { useEffect, useRef, useState } from "react";
import { useRoom } from "../lib/room";
import { useApp } from "../store";
import { speak, stopSpeaking } from "../lib/speech";
import Icon from "./Icon";

/** Full-screen incoming-call / video-call screen. Rendered once, shows on any page. */
export default function CallOverlay() {
  const { phase, callPeer, localStream, remoteStream, answer, decline, hangup } = useRoom();
  const { t, lang } = useApp();
  const remote = useRef<HTMLVideoElement>(null);
  const local = useRef<HTMLVideoElement>(null);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);

  useEffect(() => { if (remote.current) remote.current.srcObject = remoteStream; }, [remoteStream, phase]);
  useEffect(() => { if (local.current) local.current.srcObject = localStream; }, [localStream, phase]);
  useEffect(() => { if (phase === "idle") { setMic(true); setCam(true); } }, [phase]);

  // say who is calling, every few seconds, until answered
  useEffect(() => {
    if (phase !== "ringing") return;
    const say = () => { speak(`${callPeer} ${t("isCalling")}`, lang); try { navigator.vibrate?.([400, 200, 400]); } catch { /* ignore */ } };
    say();
    const id = setInterval(say, 6000);
    return () => { clearInterval(id); stopSpeaking(); };
  }, [phase, callPeer, lang, t]);

  if (phase === "idle") return null;

  if (phase === "ringing") {
    return (
      <div className="callscreen ring">
        <div className="ring-avatar"><span>{callPeer.slice(0, 1).toUpperCase()}</span></div>
        <h1>{callPeer}</h1>
        <p>{t("isCalling")}</p>
        <div className="call-actions big">
          <button className="live-btn end" onClick={decline} aria-label={t("decline")}><Icon name="phone" size={36} /></button>
          <button className="live-btn ok" onClick={answer} aria-label={t("answerCall")}><Icon name="video" size={36} /></button>
        </div>
        <div className="call-labels"><span>{t("decline")}</span><span>{t("answerCall")}</span></div>
      </div>
    );
  }

  const toggle = (kind: "audio" | "video") => {
    const tracks = kind === "audio" ? localStream?.getAudioTracks() : localStream?.getVideoTracks();
    tracks?.forEach((tr) => (tr.enabled = !tr.enabled));
    if (kind === "audio") setMic((v) => !v); else setCam((v) => !v);
  };

  return (
    <div className="callscreen">
      <video ref={remote} className="remote" autoPlay playsInline />
      {phase === "calling" && <div className="calling-note"><h1>{callPeer}</h1><p>{t("calling")}</p></div>}
      {phase === "connected" && !remoteStream?.getVideoTracks().length && <div className="calling-note"><h1>{callPeer}</h1></div>}
      <video ref={local} className="pip" autoPlay playsInline muted />
      <div className="call-actions">
        <button className={`live-btn ${mic ? "" : "on"}`} onClick={() => toggle("audio")} aria-label={t("mute")}><Icon name={mic ? "mic" : "micOff"} size={30} /></button>
        <button className="live-btn end" onClick={hangup} aria-label={t("endCall")}><Icon name="phone" size={34} /></button>
        <button className={`live-btn ${cam ? "" : "on"}`} onClick={() => toggle("video")} aria-label="camera"><Icon name={cam ? "video" : "videoOff"} size={30} /></button>
      </div>
    </div>
  );
}
