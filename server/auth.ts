import crypto from "node:crypto";
import type { Express, Request, Response, NextFunction } from "express";
import { readJson, writeJson } from "./store.js";

export interface User {
  id: string;
  username: string;
  name: string;
  room: string;
  roomCode: string; // family invite code for this person
  salt: string;
  hash: string;
  createdAt: number;
  lastSeen?: number;
}

// Older versions had administrator accounts; they simply become normal accounts now.
let users: User[] = readJson<User[]>("users.json", []);
const saveUsers = () => writeJson("users.json", users);

export const allUsers = () => users;
export const findUserById = (id: string) => users.find((u) => u.id === id);

/** The only administrator is the account whose username is "admin". */
export const ADMIN_USERNAME = "admin";
export const isAdmin = (u: User) => u.username.toLowerCase() === ADMIN_USERNAME;

export const publicUser = (u: User) => ({ id: u.id, username: u.username, name: u.name, room: u.room, roomCode: u.roomCode, isAdmin: isAdmin(u), lastSeen: u.lastSeen ?? 0 });

/* ---------- passwords (scrypt, per-user random salt) ---------- */
const hashPw = (pw: string, salt: string) => crypto.scryptSync(pw, salt, 64).toString("hex");
function verifyPw(u: User, pw: string) {
  const a = Buffer.from(hashPw(pw, u.salt), "hex");
  const b = Buffer.from(u.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newRoomCode = () => Array.from(crypto.randomBytes(8), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");

const USERNAME_RE = /^[A-Za-z0-9._-]{3,30}$/;
const MIN_PASSWORD = 4; // short on purpose: residents type it on a tablet

export function createUser(input: { username: string; name: string; room?: string; password: string }, allowAdminName = false): User {
  const username = input.username.trim();
  if (!allowAdminName && username.toLowerCase() === ADMIN_USERNAME) throw new Error("That username is reserved.");
  if (!USERNAME_RE.test(username)) throw new Error("Username must be 3-30 letters, numbers, dot, dash or underscore.");
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) throw new Error("That username is already taken.");
  const name = input.name.trim().slice(0, 60);
  if (!name) throw new Error("Please enter your name.");
  if (input.password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`);
  const salt = crypto.randomBytes(16).toString("hex");
  const u: User = {
    id: crypto.randomUUID(), username, name, room: (input.room ?? "-").trim().slice(0, 20) || "-",
    roomCode: newRoomCode(), salt, hash: hashPw(input.password, salt), createdAt: Date.now(),
  };
  users.push(u);
  saveUsers();
  return u;
}

export function updateUser(id: string, patch: { name?: string; room?: string; password?: string }) {
  const u = findUserById(id);
  if (!u) throw new Error("User not found.");
  if (patch.name !== undefined) { const n = patch.name.trim().slice(0, 60); if (!n) throw new Error("Name is required."); u.name = n; }
  if (patch.room !== undefined) u.room = patch.room.trim().slice(0, 20) || "-";
  if (patch.password) {
    const min = isAdmin(u) ? 8 : MIN_PASSWORD;
    if (patch.password.length < min) throw new Error(`Password must be at least ${min} characters.`);
    u.salt = crypto.randomBytes(16).toString("hex");
    u.hash = hashPw(patch.password, u.salt);
    if (isAdmin(u)) weakCache = null;
  }
  saveUsers();
  if (patch.password) dropSessionsOf(u.id); // the person signs in again with the new password
  return u;
}

/** True while the administrator still uses an easily guessed password (checked once, then cached). */
let weakCache: boolean | null = null;
export function adminHasWeakPassword(): boolean {
  if (weakCache !== null) return weakCache;
  const a = users.find(isAdmin);
  weakCache = !!a && ["admin123", "admin", "password", "12345678", "admin1234", "123456789"].some((p) => verifyPw(a, p));
  return weakCache;
}

export function deleteUser(id: string) {
  users = users.filter((u) => u.id !== id);
  saveUsers();
  dropSessionsOf(id);
}

/** Creates the "admin" account on first start when ADMIN_PASSWORD is set in .env (min 8 characters). */
export function ensureAdmin() {
  if (users.some(isAdmin)) return;
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) { console.log('[auth] No "admin" account yet. Set ADMIN_PASSWORD in .env and restart to create it.'); return; }
  try {
    createUser({ username: ADMIN_USERNAME, name: "Administrator", password: pw }, true);
    console.log('[auth] Created the "admin" account from ADMIN_PASSWORD.');
  } catch (e: any) { console.log("[auth] Could not create admin:", e.message); }
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
  return findUserById(s.userId) ?? null;
}

export const userOf = (req: Request) => (req as any).user as User;

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: "login" });
  const now = Date.now();
  if (now - (u.lastSeen ?? 0) > 15_000) { u.lastSeen = now; saveUsers(); } // shows "online" to the administrator
  (req as any).user = u;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireUser(req, res, () => {
    if (!isAdmin(userOf(req))) return res.status(403).json({ error: "admin only" });
    next();
  });
}

/* ---------- slow down password guessing and mass sign-ups ---------- */
const attempts = new Map<string, { count: number; until: number }>();
function throttled(key: string) { const a = attempts.get(key); return !!a && a.until > Date.now(); }
function fail(key: string, max = 5, lockMs = 60_000) {
  const a = attempts.get(key) ?? { count: 0, until: 0 };
  a.count += 1;
  if (a.count >= max) { a.until = Date.now() + lockMs; a.count = 0; }
  attempts.set(key, a);
}

export function registerAuth(app: Express) {
  // Anyone can create their own account
  app.post("/api/auth/signup", (req, res) => {
    const key = `signup|${req.ip}`;
    if (throttled(key)) return res.status(429).json({ error: "Too many new accounts from this device. Please try again later." });
    try {
      const { name, username, password, room } = req.body ?? {};
      const u = createUser({ name: String(name ?? ""), username: String(username ?? ""), password: String(password ?? ""), room: String(room ?? "-") });
      fail(key, 10, 3600_000); // at most 10 new accounts per device per hour
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
    if (!u || !verifyPw(u, password)) { fail(key); return res.status(401).json({ error: "Wrong username or password." }); }
    attempts.delete(key);
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
