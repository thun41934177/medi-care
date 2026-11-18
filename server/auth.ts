import crypto from "node:crypto";
import type { Express, Request, Response, NextFunction } from "express";
import { readJson, writeJson } from "./store.js";

export interface User {
  id: string;
  username: string;
  name: string;
  room: string;
  role: "admin" | "user";
  roomCode: string; // family invite code for this person
  salt: string;
  hash: string;
  disabled: boolean;
  createdAt: number;
  lastSeen: number;
}

let users: User[] = readJson<User[]>("users.json", []);
const saveUsers = () => writeJson("users.json", users);

export const allUsers = () => users;
export const findUserById = (id: string) => users.find((u) => u.id === id);
export const hasAdmin = () => users.some((u) => u.role === "admin" && !u.disabled);

export const publicUser = (u: User) => ({
  id: u.id, username: u.username, name: u.name, room: u.room, role: u.role,
  roomCode: u.roomCode, disabled: u.disabled, createdAt: u.createdAt, lastSeen: u.lastSeen,
});

/* ---------- passwords (scrypt, per-user random salt) ---------- */
const hashPw = (pw: string, salt: string) => crypto.scryptSync(pw, salt, 64).toString("hex");
function verifyPw(u: User, pw: string) {
  const a = Buffer.from(hashPw(pw, u.salt), "hex");
  const b = Buffer.from(u.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newRoomCode = () => Array.from(crypto.randomBytes(8), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");

export const USERNAME_RE = /^[A-Za-z0-9._-]{3,30}$/;
export function minPassword(role: "admin" | "user") { return role === "admin" ? 8 : 4; }

export function createUser(input: { username: string; name: string; room?: string; role: "admin" | "user"; password: string }): User {
  const username = input.username.trim();
  if (!USERNAME_RE.test(username)) throw new Error("Username must be 3-30 letters, numbers, dot, dash or underscore.");
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) throw new Error("That username is already taken.");
  const name = input.name.trim().slice(0, 60);
  if (!name) throw new Error("Name is required.");
  if (input.password.length < minPassword(input.role)) throw new Error(`Password must be at least ${minPassword(input.role)} characters.`);
  const salt = crypto.randomBytes(16).toString("hex");
  const u: User = {
    id: crypto.randomUUID(), username, name, room: (input.room ?? "-").trim().slice(0, 20) || "-", role: input.role,
    roomCode: newRoomCode(), salt, hash: hashPw(input.password, salt), disabled: false, createdAt: Date.now(), lastSeen: 0,
  };
  users.push(u);
  saveUsers();
  return u;
}

export function updateUser(id: string, patch: { name?: string; room?: string; disabled?: boolean; password?: string }) {
  const u = findUserById(id);
  if (!u) throw new Error("User not found.");
  if (patch.name !== undefined) { const n = patch.name.trim().slice(0, 60); if (!n) throw new Error("Name is required."); u.name = n; }
  if (patch.room !== undefined) u.room = patch.room.trim().slice(0, 20) || "-";
  if (patch.disabled !== undefined) u.disabled = patch.disabled;
  if (patch.password) {
    if (patch.password.length < minPassword(u.role)) throw new Error(`Password must be at least ${minPassword(u.role)} characters.`);
    u.salt = crypto.randomBytes(16).toString("hex");
    u.hash = hashPw(patch.password, u.salt);
  }
  saveUsers();
  if (u.disabled || patch.password) dropSessionsOf(u.id); // force sign-in again
  return u;
}

export function deleteUser(id: string) {
  users = users.filter((u) => u.id !== id);
  saveUsers();
  dropSessionsOf(id);
}

/* ---------- sessions (random token in an httpOnly cookie; only its hash is stored) ---------- */
const SESSION_MS = 30 * 24 * 3600 * 1000; // devices stay signed in for 30 days, so residents do not retype passwords
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
let sessions: Record<string, { userId: string; expires: number }> = readJson("sessions.json", {});
function saveSessions() {
  const now = Date.now();
  for (const k of Object.keys(sessions)) if (sessions[k].expires < now) delete sessions[k];
  writeJson("sessions.json", sessions);
}
function dropSessionsOf(userId: string) {
  for (const k of Object.keys(sessions)) if (sessions[k].userId === userId) delete sessions[k];
  saveSessions();
}

function cookieOf(req: Request, name: string) {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return "";
}

function startSession(req: Request, res: Response, userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions[sha(token)] = { userId, expires: Date.now() + SESSION_MS };
  saveSessions();
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${secure}`);
}

export function currentUser(req: Request): User | null {
  const token = cookieOf(req, "sid");
  if (!token) return null;
  const s = sessions[sha(token)];
  if (!s || s.expires < Date.now()) return null;
  const u = findUserById(s.userId);
  return u && !u.disabled ? u : null;
}

export const userOf = (req: Request) => (req as any).user as User;

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: "login" });
  const now = Date.now();
  if (now - u.lastSeen > 15_000) { u.lastSeen = now; saveUsers(); }
  (req as any).user = u;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireUser(req, res, () => {
    if (userOf(req).role !== "admin") return res.status(403).json({ error: "admin only" });
    next();
  });
}

/* ---------- slow down password guessing ---------- */
const attempts = new Map<string, { count: number; until: number }>();
function throttled(key: string) { const a = attempts.get(key); return !!a && a.until > Date.now(); }
function fail(key: string) {
  const a = attempts.get(key) ?? { count: 0, until: 0 };
  a.count += 1;
  if (a.count >= 5) { a.until = Date.now() + 60_000; a.count = 0; }
  attempts.set(key, a);
}

export function registerAuth(app: Express) {
  app.get("/api/auth/status", (_req, res) => res.json({ hasAdmin: hasAdmin() }));

  // First run only: create the administrator account
  app.post("/api/auth/setup", (req, res) => {
    if (hasAdmin()) return res.status(403).json({ error: "An administrator already exists." });
    try {
      const { name, username, password } = req.body ?? {};
      const u = createUser({ name: String(name ?? ""), username: String(username ?? ""), password: String(password ?? ""), role: "admin", room: "-" });
      startSession(req, res, u.id);
      res.json(publicUser(u));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post("/api/auth/login", (req, res) => {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");
    const key = `${req.ip}|${username.toLowerCase()}`;
    if (throttled(key)) return res.status(429).json({ error: "Too many tries. Please wait a minute." });
    const u = users.find((x) => x.username.toLowerCase() === username.toLowerCase());
    if (!u || u.disabled || !verifyPw(u, password)) { fail(key); return res.status(401).json({ error: "Wrong username or password." }); }
    attempts.delete(key);
    u.lastSeen = Date.now();
    saveUsers();
    startSession(req, res, u.id);
    res.json(publicUser(u));
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = cookieOf(req, "sid");
    if (token) { delete sessions[sha(token)]; saveSessions(); }
    res.setHeader("Set-Cookie", "sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    res.json({ ok: true });
  });

  app.get("/api/auth/me", requireUser, (req, res) => res.json(publicUser(userOf(req))));
}
