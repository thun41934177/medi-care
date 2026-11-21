import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { PROVIDERS, isConfigured, chatComplete, chatStream } from "./ai/providers.js";
import { createRobot, RobotCommand } from "./robot/adapter.js";
import { ttsStatus, synthesize } from "./tts.js";
import { registerAuth, requireUser, userOf, ensureAdmin } from "./auth.js";
import { addAlert } from "./activity.js";
import { registerAdmin } from "./admin.js";
import { DATA } from "./store.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.set("trust proxy", "loopback");
// Log when another device (iPad, phone) opens the app, to help with "my friend can't connect"
const seenVisit = new Map<string, number>();
app.use((req, _res, next) => {
  const ip = (req.ip ?? "").replace("::ffff:", "");
  if (req.method === "GET" && !req.path.startsWith("/api") && ip && ip !== "127.0.0.1" && ip !== "::1") {
    if (Date.now() - (seenVisit.get(ip) ?? 0) > 60_000) { seenVisit.set(ip, Date.now()); console.log(`[visit] ${ip} opened ${req.path}`); }
  }
  next();
});
ensureAdmin();
registerAuth(app);
registerAdmin(app);

const SYSTEM: Record<string, string> = {
  en: "You are a warm, patient companion for an elderly resident of a care center. Use short, simple sentences and a kind tone. Reply in English. Never diagnose or give medicine dosages; for any health worry, gently tell them to call a caregiver using the red Call Caregiver button. Suggest games, stories or music to keep them engaged.",
  th: "คุณเป็นเพื่อนคุยที่อบอุ่นและอดทนสำหรับผู้สูงอายุในศูนย์ดูแล ใช้ประโยคสั้น ๆ เข้าใจง่าย น้ำเสียงอ่อนโยน ตอบเป็นภาษาไทย ห้ามวินิจฉัยโรคหรือบอกขนาดยา หากมีเรื่องสุขภาพให้บอกให้กดปุ่มเรียกพนักงานสีแดง และชวนเล่นเกม เล่าเรื่อง หรือฟังเพลง ใช้คำลงท้ายว่า \"ค่ะ\" หรือ \"นะคะ\" เท่านั้น ห้ามใช้ \"ครับ\" และห้ามเขียนคำลงท้ายซ้อนกันด้วยเครื่องหมาย / เช่น ครับ/ค่ะ",
};

const robot = createRobot();
robot.onEvent((e) => {
  if (e.type === "fall_detected" || (e.type === "button" && e.id === "sos")) {
    addAlert({ name: "Robot", room: "-", source: "robot" });
  }
});

app.get("/api/providers", requireUser, (_req, res) => {
  res.json({
    default: process.env.DEFAULT_PROVIDER || "qwen-local",
    providers: PROVIDERS.filter(isConfigured).map(({ id, label, local }) => ({ id, label, local })),
  });
});

app.post("/api/chat", requireUser, async (req, res) => {
  const { messages = [], provider, lang = "en" } = req.body ?? {};
  const wanted = PROVIDERS.find((p) => p.id === provider && isConfigured(p));
  const fallback = PROVIDERS.find((p) => p.id === (process.env.DEFAULT_PROVIDER || "qwen-local"))!;
  const full = [{ role: "system", content: SYSTEM[lang] ?? SYSTEM.en }, ...messages.slice(-20)];
  for (const p of wanted && wanted !== fallback ? [wanted, fallback] : [fallback]) {
    try {
      const reply = await chatComplete(p, full);
      return res.json({ reply, provider: p.id });
    } catch (e: any) {
      console.error("[chat]", e.message);
    }
  }
  res.status(502).json({ error: "AI is not available. Is Ollama running with the Qwen model pulled?" });
});

const LIVE_EXTRA: Record<string, string> = {
  en: " This is a live spoken phone-style conversation. Reply in 1 to 3 short sentences, like talking to a friend. No lists, no markdown, no emojis. Ask a gentle follow-up question now and then.",
  th: " นี่คือการสนทนาด้วยเสียงสด ตอบสั้น ๆ 1-3 ประโยคเหมือนคุยกับเพื่อน ห้ามใช้ลิสต์ มาร์กดาวน์ หรืออีโมจิ และถามต่ออย่างอ่อนโยนเป็นบางครั้ง",
};

// Streaming chat (Server-Sent Events) used by the live voice call
app.post("/api/chat/stream", requireUser, async (req, res) => {
  const { messages = [], provider, lang = "en", mode } = req.body ?? {};
  const wanted = PROVIDERS.find((p) => p.id === provider && isConfigured(p));
  const fallback = PROVIDERS.find((p) => p.id === (process.env.DEFAULT_PROVIDER || "qwen-local"))!;
  const system = (SYSTEM[lang] ?? SYSTEM.en) + (mode === "live" ? (LIVE_EXTRA[lang] ?? LIVE_EXTRA.en) : "");
  const full = [{ role: "system", content: system }, ...messages.slice(-20)];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const ac = new AbortController();
  res.on("close", () => ac.abort());

  for (const p of wanted && wanted !== fallback ? [wanted, fallback] : [fallback]) {
    let started = false;
    try {
      for await (const delta of chatStream(p, full, ac.signal)) {
        started = true;
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      return res.end();
    } catch (e: any) {
      if (ac.signal.aborted) return res.end();
      console.error("[chat/stream]", e.message);
      if (started) break; // cannot switch model mid-answer
    }
  }
  res.write(`data: ${JSON.stringify({ error: "AI is not available" })}\n\n`);
  res.end();
});

app.post("/api/sos", requireUser, (req, res) => {
  const u = userOf(req);
  const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 120) : undefined;
  const alert = addAlert({ userId: u.id, name: u.name, room: u.room, source: note ? "health" : "app", note });
  robot.send({ type: "face", emotion: "alert" });
  if (process.env.SOS_WEBHOOK_URL) {
    fetch(process.env.SOS_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `SOS from ${u.name} (room ${u.room})${note ? " - " + note : ""}` }) }).catch(() => {});
  }
  res.json({ id: alert.id });
});

// Text-to-speech with the computer's own voices (Thai + English), used by every browser/tablet
app.get("/api/tts/status", async (_req, res) => res.json(await ttsStatus()));
app.post("/api/tts", requireUser, async (req, res) => {
  const { text, lang, rate } = req.body ?? {};
  if (typeof text !== "string" || !text.trim() || text.length > 800) return res.status(400).json({ error: "bad text" });
  try {
    const file = await synthesize(text, lang === "th" ? "th" : "en", Number(rate) || 0.92);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.sendFile(file);
  } catch (e: any) {
    console.error("[tts]", e.message);
    res.status(503).json({ error: "tts unavailable" });
  }
});

// Addresses other devices on the same Wi-Fi / hotspot can use to reach this computer
app.get("/api/network", requireUser, (_req, res) => {
  const ips: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list ?? []) if (i.family === "IPv4" && !i.internal) ips.push(i.address);
  }
  res.json({ ips, port: Number(process.env.PORT) || 3001 });
});

app.get("/api/robot", requireUser, (_req, res) => res.json({ adapter: robot.name, connected: robot.connected() }));
app.post("/api/robot", requireUser, (req, res) => { robot.send(req.body as RobotCommand); res.json({ ok: true }); });

const dist = path.resolve("dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

/* ---------- Family & Friends: messages + video-call signaling over WebSocket ---------- */
interface RoomMsg { id: string; from: string; role: string; text: string; at: number }
interface RoomData { messages: RoomMsg[]; known: string[] }
interface Client { id: string; ws: WebSocket; room: string; role: "resident" | "family"; name: string }

const rooms = new Map<string, Map<string, Client>>();
const CODE_RE = /^[A-Za-z0-9]{6,12}$/;
const roomFile = (room: string) => path.join(DATA, `room-${room}.json`);
const loadRoom = (room: string): RoomData => { try { return JSON.parse(fs.readFileSync(roomFile(room), "utf8")); } catch { return { messages: [], known: [] }; } };
const saveRoom = (room: string, d: RoomData) => fs.writeFileSync(roomFile(room), JSON.stringify(d));
const peersOf = (room: string) => [...(rooms.get(room)?.values() ?? [])].map((c) => ({ id: c.id, name: c.name, role: c.role }));
const sendTo = (c: Client, m: unknown) => { if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(m)); };
const broadcast = (room: string, m: unknown) => rooms.get(room)?.forEach((c) => sendTo(c, m));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 64 * 1024 });

wss.on("connection", (ws) => {
  let me: Client | null = null;
  ws.on("message", (raw) => {
    let m: any;
    try { m = JSON.parse(raw.toString()); } catch { return; }

    if (m.type === "hello" && !me) {
      const room = String(m.room ?? "");
      const name = String(m.name ?? "").trim().slice(0, 40) || "Guest";
      if (!CODE_RE.test(room) || (m.role !== "resident" && m.role !== "family")) return ws.close();
      me = { id: randomUUID(), ws, room, role: m.role, name };
      if (!rooms.has(room)) rooms.set(room, new Map());
      rooms.get(room)!.set(me.id, me);
      const data = loadRoom(room);
      if (me.role === "family" && !data.known.includes(name)) { data.known.push(name); saveRoom(room, data); }
      sendTo(me, { type: "welcome", id: me.id, messages: data.messages.slice(-60), known: data.known });
      broadcast(room, { type: "presence", peers: peersOf(room) });
      return;
    }
    if (!me) return;

    if (m.type === "chat") {
      const text = String(m.text ?? "").trim().slice(0, 500);
      if (!text) return;
      const data = loadRoom(me.room);
      const msg: RoomMsg = { id: randomUUID(), from: me.name, role: me.role, text, at: Date.now() };
      data.messages.push(msg);
      data.messages = data.messages.slice(-200);
      saveRoom(me.room, data);
      broadcast(me.room, { type: "chat", msg });
    } else if (m.type === "signal") {
      const target = rooms.get(me.room)?.get(String(m.to));
      if (target) sendTo(target, { type: "signal", from: me.id, fromName: me.name, data: m.data });
    }
  });
  ws.on("close", () => {
    if (!me) return;
    rooms.get(me.room)?.delete(me.id);
    if (rooms.get(me.room)?.size === 0) rooms.delete(me.room);
    else broadcast(me.room, { type: "presence", peers: peersOf(me.room) });
  });
  ws.on("error", () => ws.close());
});

const port = Number(process.env.PORT) || 3001;
server.listen(port, () => {
  console.log(`API on http://localhost:${port}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list ?? []) {
      if (i.family === "IPv4" && !i.internal) console.log(`Other devices on this network (iPad, phone): http://${i.address}:${port}`);
    }
  }
});
