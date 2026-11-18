import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../store";
import { ago } from "../lib/time";
import AdminShell from "../components/AdminShell";
import Icon from "../components/Icon";

export interface Summary {
  id: string; username: string; name: string; room: string; role: "admin" | "user"; roomCode: string;
  disabled: boolean; lastSeen: number; online: boolean;
  medsTotal: number; medsDue: number; medsTaken: number; medsMissed: number;
  latestHealth: { at: number; sys?: number; dia?: number; sugar?: number; sleep?: number } | null;
  healthFlag: boolean; gamesToday: number; openAlerts: number;
}
interface Alert { id: string; time: string; name: string; room: string; source: string; note?: string }
interface Overview { users: Summary[]; alerts: Alert[]; totals: { residents: number; online: number; openAlerts: number; medsMissed: number; healthFlags: number } }

export function StatusDot({ online }: { online: boolean }) { return <span className={`dot ${online ? "ok" : ""}`} />; }

export default function Admin() {
  const { t, lang } = useApp();
  const [data, setData] = useState<Overview | null>(null);
  const [form, setForm] = useState({ name: "", username: "", password: "", room: "", role: "user" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { fetch("/api/admin/overview").then((r) => r.json()).then(setData).catch(() => {}); }, []);
  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load]);

  async function ack(id: string) {
    await fetch(`/api/admin/alerts/${id}/ack`, { method: "POST" });
    load();
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: d.error || "Could not add the user." });
    setMsg({ ok: true, text: `${t("userAdded")}: ${d.name}` });
    setForm({ name: "", username: "", password: "", room: "", role: form.role });
    load();
  }

  const residents = data?.users.filter((u) => u.role === "user") ?? [];
  const admins = data?.users.filter((u) => u.role === "admin") ?? [];
  const tot = data?.totals;

  const stats: { label: string; value: number; tone?: "red" | "amber" }[] = [
    { label: t("residents"), value: tot?.residents ?? 0 },
    { label: t("onlineNow"), value: tot?.online ?? 0 },
    { label: t("openAlerts"), value: tot?.openAlerts ?? 0, tone: (tot?.openAlerts ?? 0) > 0 ? "red" : undefined },
    { label: t("medsMissedToday"), value: tot?.medsMissed ?? 0, tone: (tot?.medsMissed ?? 0) > 0 ? "amber" : undefined },
    { label: t("healthFlags"), value: tot?.healthFlags ?? 0, tone: (tot?.healthFlags ?? 0) > 0 ? "amber" : undefined },
  ];

  return (
    <AdminShell>
      <div className="stats">
        {stats.map((s) => (
          <div key={s.label} className={`stat-card ${s.tone ?? ""}`}><b>{s.value}</b><span>{s.label}</span></div>
        ))}
      </div>
      <p className="muted" style={{ margin: ".2rem 0 1rem" }}><span className="dot ok" /> {t("updatedLive")}</p>

      {data && data.alerts.length > 0 && (
        <section className="card alert-card">
          <h2><Icon name="alert" size={22} /> {t("openAlerts")}</h2>
          {data.alerts.map((a) => (
            <div key={a.id} className="alert-row">
              <div className="grow">
                <b>{a.name}</b> · {t("room")} {a.room}{a.note ? ` · ${a.note}` : ""}
                <div className="muted">{ago(new Date(a.time).getTime(), lang)} ({a.source})</div>
              </div>
              <button className="danger" onClick={() => ack(a.id)}>{t("ack")}</button>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h2><Icon name="users" size={22} /> {t("residents")}</h2>
        {residents.length === 0 ? <p className="muted">{t("noUsersYet")}</p> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>{t("residents")}</th><th>{t("room")}</th><th>{t("statusCol")}</th><th>{t("medsCol")}</th><th>{t("healthCol")}</th><th>{t("alertsCol")}</th><th /></tr>
              </thead>
              <tbody>
                {residents.map((u) => (
                  <tr key={u.id} className={u.disabled ? "off" : ""}>
                    <td><b>{u.name}</b><div className="muted">@{u.username}{u.disabled ? ` · ${t("disabledTag")}` : ""}</div></td>
                    <td>{u.room}</td>
                    <td><StatusDot online={u.online} /> {u.online ? t("online") : u.lastSeen ? ago(u.lastSeen, lang) : t("never")}</td>
                    <td>
                      {u.medsTotal === 0 ? <span className="muted">—</span> : (
                        <span className={`chip ${u.medsMissed > 0 ? "amber" : ""}`}>{u.medsTaken}/{u.medsDue}{u.medsMissed > 0 ? ` · ${t("missedTag")} ${u.medsMissed}` : ""}</span>
                      )}
                    </td>
                    <td>
                      {u.latestHealth ? (
                        <span className={`chip ${u.healthFlag ? "red" : ""}`}>
                          {u.latestHealth.sys !== undefined ? `${u.latestHealth.sys}/${u.latestHealth.dia ?? "-"}` : u.latestHealth.sugar !== undefined ? `${u.latestHealth.sugar} mg/dL` : "OK"}
                        </span>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td>{u.openAlerts > 0 ? <span className="chip red">{u.openAlerts}</span> : <span className="muted">0</span>}</td>
                    <td><Link to={`/admin/users/${u.id}`}><button className="small primary">{t("view")}</button></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="cols" style={{ marginTop: "1rem" }}>
        <form className="card" onSubmit={addUser}>
          <h2>{t("addUser")}</h2>
          <label>{t("fullName")}</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="grid-2">
            <div><label>{t("username")}</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoCapitalize="none" required /></div>
            <div><label>{t("password")}</label><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
          </div>
          <div className="grid-2">
            <div><label>{t("room")}</label><input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></div>
            <div>
              <label>{t("role")}</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="user">{t("roleResident")}</option>
                <option value="admin">{t("roleAdmin")}</option>
              </select>
            </div>
          </div>
          {msg && <p className={msg.ok ? "msg-ok" : "msg-bad"} style={{ textAlign: "left", fontSize: "1.05rem" }}>{msg.text}</p>}
          <div style={{ marginTop: "1rem" }}><button className="primary" type="submit" disabled={busy}><Icon name="plus" size={22} /> {t("add")}</button></div>
        </form>

        <section className="card">
          <h2>{t("administrators")}</h2>
          {admins.map((a) => (
            <div key={a.id} className="peer-row">
              <span className="peer-avatar">{a.name.slice(0, 1).toUpperCase()}</span>
              <div className="grow"><b>{a.name}</b><div className="muted">@{a.username}{a.disabled ? ` · ${t("disabledTag")}` : ""}</div></div>
              <StatusDot online={a.online} />
            </div>
          ))}
        </section>
      </div>
    </AdminShell>
  );
}
