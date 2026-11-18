import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useApp } from "../store";
import { speak } from "./speech";
import { useAuth } from "./auth";

export interface Peer { id: string; name: string; role: "resident" | "family" }
export interface RoomMsg { id: string; from: string; role: string; text: string; at: number }
export type CallPhase = "idle" | "calling" | "ringing" | "connected";
interface Conn { room: string; role: "resident" | "family"; name: string }

interface Ctx {
  status: "off" | "connecting" | "online";
  code: string;
  role: "resident" | "family" | null;
  myId: string;
  peers: Peer[];
  known: string[];
  messages: RoomMsg[];
  unread: number;
  markRead: () => void;
  sendChat: (text: string) => void;
  connect: (c: Conn) => void;
  call: (peer: Peer) => void;
  answer: () => void;
  decline: () => void;
  hangup: () => void;
  phase: CallPhase;
  callPeer: string;
  callError: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

const C = createContext<Ctx>(null as unknown as Ctx);
export const useRoom = () => useContext(C);

const ICE: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function residentCode(): string {
  try {
    let c = localStorage.getItem("roomCode");
    if (!c) {
      c = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => ALPHABET[b % ALPHABET.length]).join("");
      localStorage.setItem("roomCode", c);
    }
    return c;
  } catch { return "LOCALROOM"; }
}

export function RoomProvider({ children }: { children: ReactNode }) {
  const { lang, t } = useApp();
  const { user } = useAuth();
  const loc = useLocation();
  const isJoinPage = loc.pathname.startsWith("/join");

  const [conn, setConn] = useState<Conn | null>(null);
  const [status, setStatus] = useState<Ctx["status"]>("off");
  const [myId, setMyId] = useState("");
  const [peers, setPeers] = useState<Peer[]>([]);
  const [known, setKnown] = useState<string[]>([]);
  const [messages, setMessages] = useState<RoomMsg[]>([]);
  const [unread, setUnread] = useState(0);
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [callPeer, setCallPeer] = useState("");
  const [callError, setCallError] = useState("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const ws = useRef<WebSocket | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const peerId = useRef("");
  const offer = useRef<RTCSessionDescriptionInit | null>(null);
  const candidates = useRef<RTCIceCandidateInit[]>([]);
  const phaseRef = useRef<CallPhase>("idle");
  const langRef = useRef(lang);
  const connRef = useRef<Conn | null>(null);
  langRef.current = lang;
  connRef.current = conn;

  const setPhaseBoth = (p: CallPhase) => { phaseRef.current = p; setPhase(p); };

  // the resident device always listens, so family calls can arrive on any screen
  useEffect(() => {
    if (isJoinPage) return;
    setConn(user && user.role === "user" ? { room: user.roomCode, role: "resident", name: user.name } : null);
  }, [isJoinPage, user?.id, user?.name, user?.roomCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = (m: unknown) => { if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(m)); };
  const signal = (to: string, data: unknown) => send({ type: "signal", to, data });

  const cleanup = useCallback(() => {
    pc.current?.close();
    pc.current = null;
    local.current?.getTracks().forEach((tr) => tr.stop());
    local.current = null;
    offer.current = null;
    candidates.current = [];
    peerId.current = "";
    setLocalStream(null);
    setRemoteStream(null);
    setPhaseBoth("idle");
  }, []);

  async function getMedia(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("https");
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "user" } });
    } catch {
      return await navigator.mediaDevices.getUserMedia({ audio: true }); // no camera: voice only
    }
  }

  function makePc(to: string, stream: MediaStream) {
    const p = new RTCPeerConnection(ICE);
    stream.getTracks().forEach((tr) => p.addTrack(tr, stream));
    p.onicecandidate = (e) => { if (e.candidate) signal(to, { kind: "candidate", candidate: e.candidate }); };
    p.ontrack = (e) => setRemoteStream(e.streams[0]);
    p.onconnectionstatechange = () => {
      if (p.connectionState === "connected") setPhaseBoth("connected");
      if (p.connectionState === "failed" || p.connectionState === "closed") cleanup();
    };
    pc.current = p;
    return p;
  }

  async function flushCandidates() {
    for (const c of candidates.current) { try { await pc.current?.addIceCandidate(c); } catch { /* ignore */ } }
    candidates.current = [];
  }

  const call = async (peer: Peer) => {
    if (phaseRef.current !== "idle") return;
    setCallError("");
    try {
      const stream = await getMedia();
      local.current = stream;
      setLocalStream(stream);
      peerId.current = peer.id;
      setCallPeer(peer.name);
      setPhaseBoth("calling");
      const p = makePc(peer.id, stream);
      const o = await p.createOffer();
      await p.setLocalDescription(o);
      signal(peer.id, { kind: "offer", sdp: p.localDescription });
    } catch (e: any) {
      setCallError(e?.message === "https" ? "https" : "media");
      cleanup();
    }
  };

  const answer = async () => {
    if (phaseRef.current !== "ringing" || !offer.current) return;
    try {
      const stream = await getMedia();
      local.current = stream;
      setLocalStream(stream);
      const to = peerId.current;
      const p = makePc(to, stream);
      await p.setRemoteDescription(offer.current);
      await flushCandidates();
      const a = await p.createAnswer();
      await p.setLocalDescription(a);
      signal(to, { kind: "answer", sdp: p.localDescription });
    } catch (e: any) {
      setCallError(e?.message === "https" ? "https" : "media");
      signal(peerId.current, { kind: "decline" });
      cleanup();
    }
  };

  const decline = () => { if (peerId.current) signal(peerId.current, { kind: "decline" }); cleanup(); };
  const hangup = () => { if (peerId.current) signal(peerId.current, { kind: "hangup" }); cleanup(); };

  async function onSignal(from: string, fromName: string, d: any) {
    if (d.kind === "offer") {
      if (phaseRef.current !== "idle") return signal(from, { kind: "busy" });
      peerId.current = from;
      offer.current = d.sdp;
      setCallPeer(fromName);
      setPhaseBoth("ringing");
    } else if (d.kind === "answer") {
      if (pc.current && from === peerId.current) { await pc.current.setRemoteDescription(d.sdp); await flushCandidates(); }
    } else if (d.kind === "candidate") {
      if (from !== peerId.current) return;
      if (pc.current?.remoteDescription) { try { await pc.current.addIceCandidate(d.candidate); } catch { /* ignore */ } }
      else candidates.current.push(d.candidate);
    } else if (d.kind === "hangup" || d.kind === "decline" || d.kind === "busy") {
      if (from === peerId.current) cleanup();
    }
  }

  // websocket lifecycle (auto-reconnects)
  useEffect(() => {
    if (!conn) return;
    let closed = false;
    let timer: ReturnType<typeof setTimeout>;
    const open = () => {
      setStatus("connecting");
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const s = new WebSocket(`${proto}://${location.host}/ws`);
      ws.current = s;
      s.onopen = () => s.send(JSON.stringify({ type: "hello", ...conn }));
      s.onmessage = (ev) => {
        let m: any;
        try { m = JSON.parse(ev.data); } catch { return; }
        if (m.type === "welcome") { setMyId(m.id); setMessages(m.messages); setKnown(m.known); setStatus("online"); }
        else if (m.type === "presence") setPeers(m.peers);
        else if (m.type === "chat") {
          setMessages((o) => [...o, m.msg].slice(-200));
          if (connRef.current?.role === "resident" && m.msg.role === "family") {
            setUnread((u) => u + 1);
            speak(`${m.msg.from}: ${m.msg.text}`, langRef.current);
          }
        } else if (m.type === "signal") onSignal(m.from, m.fromName, m.data);
      };
      s.onclose = () => {
        setStatus("off");
        setPeers([]);
        if (phaseRef.current !== "idle") cleanup();
        if (!closed) timer = setTimeout(open, 3000);
      };
    };
    open();
    return () => { closed = true; clearTimeout(timer); ws.current?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn?.room, conn?.role, conn?.name]);

  const value: Ctx = {
    status, code: conn?.room ?? "", role: conn?.role ?? null, myId, peers, known, messages, unread,
    markRead: () => setUnread(0),
    sendChat: (text) => send({ type: "chat", text }),
    connect: setConn,
    call, answer, decline, hangup, phase, callPeer, callError, localStream, remoteStream,
  };
  void t;
  return <C.Provider value={value}>{children}</C.Provider>;
}
