import { db, HealthLog } from "../db";

/** Reports activity to the server so the administrator can monitor everyone. Never blocks the app if it fails. */
const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});

export async function syncMeds() {
  const meds = await db.meds.toArray();
  post("/api/sync/meds", { meds: meds.map((m) => ({ name: m.name, time: m.time })) });
}
export const syncDose = (name: string, time: string, date: string, status: "taken" | "skipped") => post("/api/sync/dose", { name, time, date, status });
export const syncHealth = (h: HealthLog) => post("/api/sync/health", h);
export const syncGame = (g: { at: number; game: string; level: string; score: number; total: number }) => post("/api/sync/game", g);
