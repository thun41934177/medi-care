import type { Express } from "express";
import {
  requireUser, requireAdmin, userOf, allUsers, findUserById, publicUser,
  createUser, updateUser, deleteUser, type User,
} from "./auth.js";
import { readJson, writeJson, removeFile, localDate } from "./store.js";

/* ---------- what each person's device reports to the server ---------- */
interface UserData {
  meds: { name: string; time: string }[];
  doses: { name: string; time: string; date: string; status: string; at: number }[];
  health: { at: number; sys?: number; dia?: number; sugar?: number; sleep?: number; mood?: string }[];
  games: { at: number; game: string; level: string; score: number; total: number }[];
}
const emptyData = (): UserData => ({ meds: [], doses: [], health: [], games: [] });
const loadData = (id: string) => readJson<UserData>(`data-${id}.json`, emptyData());
const saveData = (id: string, d: UserData) => writeJson(`data-${id}.json`, d);

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown, max = 80) => String(v ?? "").slice(0, max);
const keepLast = <T,>(a: T[], n: number) => (a.length > n ? a.slice(a.length - n) : a);

export const isAbnormal = (h: UserData["health"][number]) =>
  (h.sys !== undefined && (h.sys >= 160 || h.sys < 90)) ||
  (h.dia !== undefined && (h.dia >= 100 || h.dia < 55)) ||
  (h.sugar !== undefined && (h.sugar >= 250 || h.sugar < 70)) ||
  (h.sleep !== undefined && h.sleep < 3);

/* ---------- SOS alerts ---------- */
export interface Alert { id: string; time: string; userId?: string; name: string; room: string; source: string; note?: string; acked: boolean }
export const readAlerts = () => readJson<Alert[]>("sos.json", []);
export function addAlert(a: { userId?: string; name: string; room: string; source: string; note?: string }): Alert {
  const alert: Alert = { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), time: new Date().toISOString(), acked: false, ...a };
  writeJson("sos.json", [alert, ...readAlerts()].slice(0, 500));
  return alert;
}

/* ---------- summary of one person for the admin dashboard ---------- */
const ONLINE_MS = 90_000;
const takenToday = (d: UserData, m: { name: string; time: string }, today: string) =>
  d.doses.some((x) => x.date === today && x.name === m.name && x.time === m.time && x.status === "taken");

function summaryOf(u: User) {
  const d = loadData(u.id);
  const today = localDate();
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const due = d.meds.filter((m) => m.time <= hm);
  const taken = due.filter((m) => takenToday(d, m, today)).length;
  const latest = d.health[d.health.length - 1];
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  return {
    ...publicUser(u),
    online: Date.now() - u.lastSeen < ONLINE_MS,
    medsTotal: d.meds.length,
    medsDue: due.length,
    medsTaken: taken,
    medsMissed: due.length - taken,
    latestHealth: latest ?? null,
    healthFlag: latest ? isAbnormal(latest) : false,
    gamesToday: d.games.filter((g) => g.at >= todayStart.getTime()).length,
    openAlerts: readAlerts().filter((a) => a.userId === u.id && !a.acked).length,
  };
}

export function registerAdmin(app: Express) {
  /* ----- reported by each signed-in device ----- */
  app.post("/api/ping", requireUser, (_req, res) => res.status(204).end());

  app.post("/api/sync/meds", requireUser, (req, res) => {
    const list = Array.isArray(req.body?.meds) ? req.body.meds : [];
    const d = loadData(userOf(req).id);
    d.meds = list.slice(0, 50).map((m: any) => ({ name: str(m?.name), time: str(m?.time, 5) })).filter((m: any) => m.name && /^\d\d:\d\d$/.test(m.time));
    saveData(userOf(req).id, d);
    res.json({ ok: true });
  });

  app.post("/api/sync/dose", requireUser, (req, res) => {
    const b = req.body ?? {};
    const d = loadData(userOf(req).id);
    d.doses.push({ name: str(b.name), time: str(b.time, 5), date: str(b.date, 10), status: b.status === "taken" ? "taken" : "skipped", at: Date.now() });
    d.doses = keepLast(d.doses, 500);
    saveData(userOf(req).id, d);
    res.json({ ok: true });
  });

  app.post("/api/sync/health", requireUser, (req, res) => {
    const b = req.body ?? {};
    const d = loadData(userOf(req).id);
    d.health.push({ at: num(b.at) ?? Date.now(), sys: num(b.sys), dia: num(b.dia), sugar: num(b.sugar), sleep: num(b.sleep), mood: b.mood ? str(b.mood, 20) : undefined });
    d.health = keepLast(d.health, 500);
    saveData(userOf(req).id, d);
    res.json({ ok: true });
  });

  app.post("/api/sync/game", requireUser, (req, res) => {
    const b = req.body ?? {};
    const d = loadData(userOf(req).id);
    d.games.push({ at: num(b.at) ?? Date.now(), game: str(b.game, 20), level: str(b.level, 10), score: num(b.score) ?? 0, total: num(b.total) ?? 0 });
    d.games = keepLast(d.games, 500);
    saveData(userOf(req).id, d);
    res.json({ ok: true });
  });

  /* ----- admin only ----- */
  app.get("/api/admin/overview", requireAdmin, (_req, res) => {
    const users = allUsers().map(summaryOf);
    const alerts = readAlerts().filter((a) => !a.acked).slice(0, 50);
    const residents = users.filter((u) => u.role === "user" && !u.disabled);
    res.json({
      users,
      alerts,
      totals: {
        residents: residents.length,
        online: residents.filter((u) => u.online).length,
        openAlerts: alerts.length,
        medsMissed: residents.reduce((n, u) => n + u.medsMissed, 0),
        healthFlags: residents.filter((u) => u.healthFlag).length,
      },
    });
  });

  app.post("/api/admin/users", requireAdmin, (req, res) => {
    try {
      const b = req.body ?? {};
      const u = createUser({
        name: String(b.name ?? ""), username: String(b.username ?? ""), password: String(b.password ?? ""),
        room: String(b.room ?? "-"), role: b.role === "admin" ? "admin" : "user",
      });
      res.json(publicUser(u));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get("/api/admin/users/:id", requireAdmin, (req, res) => {
    const u = findUserById(req.params.id);
    if (!u) return res.status(404).json({ error: "not found" });
    const d = loadData(u.id);
    const today = localDate();
    res.json({
      user: summaryOf(u),
      meds: d.meds.map((m) => ({ ...m, takenToday: takenToday(d, m, today) })),
      health: d.health.slice(-40).reverse().map((h) => ({ ...h, abnormal: isAbnormal(h) })),
      games: d.games.slice(-40).reverse(),
      alerts: readAlerts().filter((a) => a.userId === u.id).slice(0, 30),
    });
  });

  app.patch("/api/admin/users/:id", requireAdmin, (req, res) => {
    const id = req.params.id;
    const b = req.body ?? {};
    if (id === userOf(req).id && b.disabled === true) return res.status(400).json({ error: "You cannot disable your own account." });
    try {
      const u = updateUser(id, {
        name: b.name !== undefined ? String(b.name) : undefined,
        room: b.room !== undefined ? String(b.room) : undefined,
        disabled: typeof b.disabled === "boolean" ? b.disabled : undefined,
        password: b.password ? String(b.password) : undefined,
      });
      res.json(publicUser(u));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/admin/users/:id", requireAdmin, (req, res) => {
    const id = req.params.id;
    const u = findUserById(id);
    if (!u) return res.status(404).json({ error: "not found" });
    if (id === userOf(req).id) return res.status(400).json({ error: "You cannot delete your own account." });
    if (u.role === "admin" && allUsers().filter((x) => x.role === "admin").length <= 1) return res.status(400).json({ error: "You cannot delete the last administrator." });
    deleteUser(id);
    removeFile(`data-${id}.json`);
    res.json({ ok: true });
  });

  app.get("/api/admin/alerts", requireAdmin, (_req, res) => res.json(readAlerts().slice(0, 100)));
  app.post("/api/admin/alerts/:id/ack", requireAdmin, (req, res) => {
    const list = readAlerts();
    const a = list.find((x) => x.id === req.params.id);
    if (a) a.acked = true;
    writeJson("sos.json", list);
    res.json({ ok: true });
  });
}
