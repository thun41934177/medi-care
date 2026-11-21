import { db, HealthLog } from "../db";

/** Reports a resident's activity to the server so the administrator can monitor their condition. Never blocks the app if it fails. */
const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});

/** allowEmpty=false is used at sign-in, so a new empty device never wipes a schedule reported by another device. */
export async function syncMeds(allowEmpty = true) {
  const meds = await db.meds.toArray();
  if (meds.length === 0 && !allowEmpty) return;
  post("/api/sync/meds", { meds: meds.map((m) => ({ name: m.name, time: m.time })) });
}
export const syncDose = (name: string, time: string, date: string, status: "taken" | "skipped") => post("/api/sync/dose", { name, time, date, status });
export const syncHealth = (h: HealthLog) => post("/api/sync/health", h);
export const syncGame = (g: { at: number; game: string; level: string; score: number; total: number }) => post("/api/sync/game", g);

/** On sign-in: send the medicine schedule plus the records already saved on this device (the server skips duplicates). */
export async function syncAll() {
  try {
    await syncMeds(false);
    const [meds, doses, health, games] = await Promise.all([
      db.meds.toArray(), db.doses.toArray(), db.health.orderBy("at").reverse().limit(100).toArray(), db.games.orderBy("at").reverse().limit(100).toArray(),
    ]);
    const byId = new Map(meds.map((m) => [m.id, m]));
    post("/api/sync/bulk", {
      health: health.map(({ at, sys, dia, sugar, sleep, mood }) => ({ at, sys, dia, sugar, sleep, mood })),
      games: games.map(({ at, game, level, score, total }) => ({ at, game, level, score, total })),
      doses: doses.slice(-200).flatMap((d) => { const m = byId.get(d.medId); return m ? [{ name: m.name, time: m.time, date: d.date, status: d.status }] : []; }),
    });
  } catch { /* offline: try again next time */ }
}
