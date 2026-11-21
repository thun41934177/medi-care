import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../store";
import { useAuth } from "../lib/auth";
import { ago } from "../lib/time";
import AdminShell from "../components/AdminShell";
import Icon from "../components/Icon";
import type { Key } from "../i18n";

export interface Summary {
  id: string; username: string; name: string; room: string; roomCode: string; lastSeen: number; online: boolean;
  medsTotal: number; medsDue: number; medsTaken: number; medsMissed: number;
  latestHealth: { at: number; sys?: number; dia?: number; sugar?: number; sleep?: number; mood?: string } | null;
  healthFlag: boolean; gamesToday: number; openAlerts: number;
  status: "alert" | "watch" | "stable" | "nodata"; reasons: string[];
}
interface Alert { id: string; time: string; name: string; room: string; source: string; note?: string }
interface Overview {
  users: Summary[]; alerts: Alert[];
  totals: { residents: number; online: number; openAlerts: number; attention: number; watch: number; medsMissed: number };
  weakAdminPassword?: boolean;
}

export const STATUS_KEY: Record<Summary["status"], Key> = { alert: "condAlert", watch: "condWatch", stable: "condStable", nodata: "condNoData" };
export const REASON_KEY: Record<string, Key> = { sos: "reasonSos", vitals: "reasonVitals", meds: "reasonMeds", mood: "reasonMood" };
const RANK = { alert: 0, watch: 1, stable: 2, nodata: 3 } as const;

export function StatusDot({ online }: { online: boolean }) { return <span className={`dot ${online ? "ok" : ""}`} />; }

/** A patient's condition as a labelled badge (text + colour, never colour alone). */
export function Condition({ s }: { s: Summary }) {
  const { t } = useApp();
  return (
    <div>
      <span className={`cond ${s.status}`}>{s.status === "alert" && <Icon name="alert" size={14} />}{t(STATUS_KEY[s.status])}</span>
      {s.reasons.length > 0 && <div className="reasons">{s.reasons.map((r) => t(REASON_KEY[r])).join(" · ")}</div>}
    </div>
  );
}

export default function Admin() {
  const { t, lang } = useApp();
  const { user } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [form, setForm] = useState({ name: "", username: "", password: "", room: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pw, setPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { fetch("/api/admin/overview").then((r) => r.json()).then(setData).catch(() => {}); }, []);
  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load]);

  async function ack(id: string) { await fetch(`/api/admin/alerts/${id}/ack`, { method: "POST" }); load(); }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: d.error || "Could not add the user." });
    setMsg({ ok: true, text: `${t("userAdded")}: ${d.name}` });
    setForm({ name: "", username: "", password: "", room: "" });
    load();
  }

  async function changePw() {
    const r = await fetch(`/api/admin/users/${user!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setPwMsg({ ok: true, text: t("passwordChanged") }); setPw(""); load(); } else setPwMsg({ ok: false, text: d.error || "Error" });
  }

  const users = [...(data?.users ?? [])].sort((a, b) => RANK[a.status] - RANK[b.status] || a.name.localeCompare(b.name));
  const tot = data?.totals;
  const stats: { label: string; value: number; tone?: "red" | "amber" }[] = [
    { label: t("residents"), value: tot?.residents ?? 0 },
    { label: t("onlineNow"), value: tot?.online ?? 0 },
    { label: t("needAttention"), value: tot?.attention ?? 0, tone: (tot?.attention ?? 0) > 0 ? "red" : undefined },
    { label: t("openAlerts"), value: tot?.openAlerts ?? 0, tone: (tot?.openAlerts ?? 0) > 0 ? "red" : undefined },
    { label: t("medsMissedToday"), value: tot?.medsMissed ?? 0, tone: (tot?.medsMissed ?? 0) > 0 ? "amber" : undefined },
  ];

  return (
    <AdminShell>
      {data?.weakAdminPassword && <div className="notice"><Icon name="alert" size={20} /> {t("weakAdminPw")}</div>}

      <div className="stats">
        {stats.map((s) => <div key={s.label} className={`stat-card ${s.tone ?? ""}`}><b>{s.value}</b><span>{s.label}</span></div>)}
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
        {users.length === 0 ? <p className="muted">{t("noUsersYet")}</p> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>{t("residents")}</th><th>{t("room")}</th><th>{t("condition")}</th><th>{t("statusCol")}</th><th>{t("medsCol")}</th><th>{t("healthCol")}</th><th /></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><b>{u.name}</b><div className="muted">@{u.username}</div></td>
                    <td>{u.room}</td>
                    <td><Condition s={u} /></td>
                    <td><StatusDot online={u.online} /> {u.online ? t("online") : u.lastSeen ? ago(u.lastSeen, lang) : t("never")}</td>
                    <td>{u.medsTotal === 0 ? <span className="muted">—</span> : <span className={`chip ${u.medsMissed > 0 ? "amber" : ""}`}>{u.medsTaken}/{u.medsDue}{u.medsMissed > 0 ? ` · ${t("missedTag")} ${u.medsMissed}` : ""}</span>}</td>
                    <td>
                      {u.latestHealth ? (
                        <span className={`chip ${u.healthFlag ? "red" : ""}`}>
                          {u.latestHealth.sys !== undefined ? `${u.latestHealth.sys}/${u.latestHealth.dia ?? "-"}` : u.latestHealth.sugar !== undefined ? `${u.latestHealth.sugar} mg/dL` : "OK"}
                        </span>
                      ) : <span className="muted">—</span>}
                    </td>
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
          <label>{t("room")}</label>
          <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
          {msg && <p className={msg.ok ? "msg-ok" : "msg-bad"} style={{ textAlign: "left", fontSize: "1.05rem" }}>{msg.text}</p>}
          <div style={{ marginTop: "1rem" }}><button className="primary" type="submit" disabled={busy}><Icon name="plus" size={22} /> {t("add")}</button></div>
        </form>

        <section className="card">
          <h2>{t("yourAccount")}</h2>
          <div className="peer-row" style={{ borderTop: "none", paddingTop: 0 }}>
            <span className="peer-avatar">{user?.name.slice(0, 1).toUpperCase()}</span>
            <div className="grow"><b>{user?.name}</b><div className="muted">@{user?.username}</div></div>
          </div>
          <label>{t("newPassword")}</label>
          <div className="pw-row">
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
            <button className="primary" disabled={pw.length < 8} onClick={changePw}>{t("save")}</button>
          </div>
          {pwMsg && <p className={pwMsg.ok ? "msg-ok" : "msg-bad"} style={{ textAlign: "left", fontSize: "1.05rem" }}>{pwMsg.text}</p>}
        </section>
      </div>
    </AdminShell>
  );
}
