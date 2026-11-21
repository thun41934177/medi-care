import { readJson, writeJson } from "./store.js";

/* ---------- SOS alerts (shown to the administrator) ---------- */
export interface Alert { id: string; time: string; userId?: string; name: string; room: string; source: string; note?: string; acked: boolean }

export const readAlerts = () => readJson<Alert[]>("sos.json", []);

export function addAlert(a: { userId?: string; name: string; room: string; source: string; note?: string }): Alert {
  const alert: Alert = { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), time: new Date().toISOString(), acked: false, ...a };
  writeJson("sos.json", [alert, ...readAlerts()].slice(0, 500));
  return alert;
}
