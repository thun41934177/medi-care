import type { Express } from "express";
import { requireUser, requireAdmin, userOf, allUsers, findUserById, publicUser, createUser, updateUser, deleteUser, isAdmin, adminHasWeakPassword, type User } from "./auth.js";
import { readAlerts, addAlert as _unused, type Alert } from "./activity.js";
import { readJson, writeJson, removeFile, localDate } from "./store.js";
void _unused;

/* ---------- what each resident's device reports to the server ---------- */
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

type Health = UserData["health"][number];
export const isAbnormal = (h: Health) =>
  (h.sys !== undefined && (h.sys >= 160 || h.sys < 90)) ||
  (h.dia !== undefined && (h.dia >= 100 || h.dia < 55)) ||
  (h.sugar !== undefined && (h.sugar >= 250 || h.sugar < 70)) ||
  (h.sleep !== undefined && h.sleep < 3);

const takenToday = (d: UserData, m: { name: string; time: string }, today: string) =>
  d.doses.some((x) => x.date === today && x.name === m.name && x.time === m.time && x.status === "taken");

const ONLINE_MS = 90_000;

/** One resident's condition at a glance. */
function summaryOf(u: User) {
  const d = loadData(u.id);
  const today = localDate();
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const due = d.meds.filter((m) => m.time <= hm);
  const taken = due.filter((m) => takenToday(d, m, today)).length;
  const latest = d.health[d.health.length - 1];
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const openAlerts = readAlerts().filter((a) => a.userId === u.id && !a.acked).length;
  const healthFlag = latest ? isAbnormal(latest) : false;
  const medsMissed = due.length - taken;

  const reasons: string[] = [];
  if (openAlerts > 0) reasons.push("sos");
  if (healthFlag) reasons.push("vitals");
  if (medsMissed > 0) reasons.push("meds");
  if (latest?.mood === "sad") reasons.push("mood");
  const hasData = d.meds.length > 0 || d.health.length > 0 || d.games.length > 0 || (u.lastSeen ?? 0) > 0;
  const status = openAlerts > 0 || healthFlag ? "alert" : reasons.length ? "watch" : hasData ? "stable" : "nodata";

  return {
    ...publicUser(u),
    online: Date.now() - (u.lastSeen ?? 0) < ONLINE_MS,
    medsTotal: d.meds.length, medsDue: due.length, medsTaken: taken, medsMissed,
    latestHealth: latest ?? null,
    healthFlag,
    gamesToday: d.games.filter((g) => g.at >= todayStart.getTime()).length,
    openAlerts,
    status,
    reasons,
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

  // On sign-in a device sends what it already has (older records), without creating duplicates
  app.post("/api/sync/bulk", requireUser, (req, res) => {
    const b = req.body ?? {};
    const d = loadData(userOf(req).id);
    const haveHealth = new Set(d.health.map((h) => h.at));
    for (const h of (Array.isArray(b.health) ? b.health : []).slice(0, 200)) {
      const at = num(h?.at); if (at === undefined || haveHealth.has(at)) continue;
      d.health.push({ at, sys: num(h.sys), dia: num(h.dia), sugar: num(h.sugar), sleep: num(h.sleep), mood: h.mood ? str(h.mood, 20) : undefined });
    }
    const haveGames = new Set(d.games.map((g) => g.at));
    for (const g of (Array.isArray(b.games) ? b.games : []).slice(0, 200)) {
      const at = num(g?.at); if (at === undefined || haveGames.has(at)) continue;
      d.games.push({ at, game: str(g.game, 20), level: str(g.level, 10), score: num(g.score) ?? 0, total: num(g.total) ?? 0 });
    }
    const haveDose = new Set(d.doses.map((x) => `${x.date}|${x.name}|${x.time}|${x.status}`));
    for (const x of (Array.isArray(b.doses) ? b.doses : []).slice(0, 300)) {
      const k = `${str(x?.date, 10)}|${str(x?.name)}|${str(x?.time, 5)}|${x?.status === "taken" ? "taken" : "skipped"}`;
      if (haveDose.has(k)) continue;
      d.doses.push({ name: str(x.name), time: str(x.time, 5), date: str(x.date, 10), status: x.status === "taken" ? "taken" : "skipped", at: Date.now() });
    }
    d.health.sort((a, b2) => a.at - b2.at); d.games.sort((a, b2) => a.at - b2.at);
    d.health = keepLast(d.health, 500); d.games = keepLast(d.games, 500); d.doses = keepLast(d.doses, 500);
    saveData(userOf(req).id, d);
    res.json({ ok: true });
  });

  /* ----- administrator only ----- */
  app.get("/api/admin/overview", requireAdmin, (_req, res) => {
    const users = allUsers().filter((u) => !isAdmin(u)).map(summaryOf);
    const alerts = readAlerts().filter((a) => !a.acked).slice(0, 50);
    const count = (s: string) => users.filter((u) => u.status === s).length;
    res.json({
      weakAdminPassword: adminHasWeakPassword(),
      users,
      alerts,
      totals: {
        residents: users.length,
        online: users.filter((u) => u.online).length,
        openAlerts: alerts.length,
        attention: count("alert"),
        watch: count("watch"),
        medsMissed: users.reduce((n, u) => n + u.medsMissed, 0),
      },
    });
  });

  app.post("/api/admin/users", requireAdmin, (req, res) => {
    try {
      const b = req.body ?? {};
      const u = createUser({ name: String(b.name ?? ""), username: String(b.username ?? ""), password: String(b.password ?? ""), room: String(b.room ?? "-") });
      res.json(publicUser(u));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get("/api/admin/users/:id", requireAdmin, (req, res) => {
    const u = findUserById(req.params.id);
    if (!u || isAdmin(u)) return res.status(404).json({ error: "not found" });
    const d = loadData(u.id);
    const today = localDate();
    res.json({
      user: summaryOf(u),
      meds: d.meds.map((m) => ({ ...m, takenToday: takenToday(d, m, today) })),
      health: d.health.slice(-60).reverse().map((h) => ({ ...h, abnormal: isAbnormal(h) })),
      games: d.games.slice(-30).reverse(),
      alerts: readAlerts().filter((a) => a.userId === u.id).slice(0, 30),
    });
  });

  app.patch("/api/admin/users/:id", requireAdmin, (req, res) => {
    const b = req.body ?? {};
    try {
      const u = updateUser(req.params.id, {
        name: b.name !== undefined ? String(b.name) : undefined,
        room: b.room !== undefined ? String(b.room) : undefined,
        password: b.password ? String(b.password) : undefined,
      });
      res.json(publicUser(u));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/admin/users/:id", requireAdmin, (req, res) => {
    const u = findUserById(req.params.id);
    if (!u) return res.status(404).json({ error: "not found" });
    if (isAdmin(u)) return res.status(400).json({ error: "The administrator account cannot be deleted." });
    deleteUser(u.id);
    removeFile(`data-${u.id}.json`);
    res.json({ ok: true });
  });

  app.get("/api/admin/alerts", requireAdmin, (_req, res) => res.json(readAlerts().slice(0, 100)));
  app.post("/api/admin/alerts/:id/ack", requireAdmin, (req, res) => {
    const list: Alert[] = readAlerts();
    const a = list.find((x) => x.id === req.params.id);
    if (a) a.acked = true;
    writeJson("sos.json", list);
    res.json({ ok: true });
  });
}
