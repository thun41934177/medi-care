import type { Express } from "express";
import { requireUser } from "./auth.js";
import { readJson, writeJson } from "./store.js";

/* ---------- SOS alerts (shown to caregivers on the Staff page) ---------- */
export interface Alert { id: string; time: string; userId?: string; name: string; room: string; source: string; note?: string; acked: boolean }

export const readAlerts = () => readJson<Alert[]>("sos.json", []);

export function addAlert(a: { userId?: string; name: string; room: string; source: string; note?: string }): Alert {
  const alert: Alert = { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), time: new Date().toISOString(), acked: false, ...a };
  writeJson("sos.json", [alert, ...readAlerts()].slice(0, 500));
  return alert;
}

export function registerActivity(app: Express) {
  app.get("/api/alerts", requireUser, (_req, res) => res.json(readAlerts().slice(0, 100)));
  app.post("/api/alerts/:id/ack", requireUser, (req, res) => {
    const list = readAlerts();
    const a = list.find((x) => x.id === req.params.id);
    if (a) a.acked = true;
    writeJson("sos.json", list);
    res.json({ ok: true });
  });
}
