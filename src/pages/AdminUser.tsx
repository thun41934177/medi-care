import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../store";
import { ago } from "../lib/time";
import AdminShell from "../components/AdminShell";
import Icon from "../components/Icon";
import { StatusDot, type Summary } from "./Admin";

interface Detail {
  user: Summary;
  meds: { name: string; time: string; takenToday: boolean }[];
  health: { at: number; sys?: number; dia?: number; sugar?: number; sleep?: number; mood?: string; abnormal: boolean }[];
  games: { at: number; game: string; level: string; score: number; total: number }[];
  alerts: { id: string; time: string; source: string; note?: string; acked: boolean }[];
}

export default function AdminUser() {
  const { id = "" } = useParams();
  const { t, lang } = useApp();
  const nav = useNavigate();
  const [d, setD] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch(`/api/admin/users/${id}`).then((r) => { if (r.status === 404) { setMissing(true); return null; } return r.json(); }).then((x) => x && setD(x)).catch(() => {});
  }, [id]);
  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [load]);

  async function patch(body: object, okText: string) {
    const r = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const x = await r.json().catch(() => ({}));
    setMsg({ ok: r.ok, text: r.ok ? okText : x.error || "Error" });
    if (r.ok) load();
    return r.ok;
  }
  async function remove() {
    if (!window.confirm(t("confirmDelete"))) return;
    const r = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (r.ok) nav("/admin", { replace: true });
    else setMsg({ ok: false, text: (await r.json().catch(() => ({}))).error || "Error" });
  }

  if (missing) return <AdminShell><Link to="/admin"><button><Icon name="back" size={20} /> {t("backToList")}</button></Link><p>Not found.</p></AdminShell>;
  if (!d) return <AdminShell><p className="muted">{t("loading")}</p></AdminShell>;
  const u = d.user;
  const nowHM = new Date().toTimeString().slice(0, 5);

  return (
    <AdminShell>
      <Link to="/admin"><button className="small"><Icon name="back" size={18} /> {t("backToList")}</button></Link>

      <div className="card profile">
        <span className="peer-avatar lg">{u.name.slice(0, 1).toUpperCase()}</span>
        <div className="grow">
          <h1 style={{ fontSize: "1.8rem" }}>{u.name}</h1>
          <div className="muted">@{u.username} · {t("room")} {u.room} · {u.role === "admin" ? t("roleAdmin") : t("roleResident")}{u.disabled ? ` · ${t("disabledTag")}` : ""}</div>
          <div style={{ marginTop: ".4rem" }}><StatusDot online={u.online} /> {u.online ? t("online") : u.lastSeen ? ago(u.lastSeen, lang) : t("never")}</div>
        </div>
        <div className="code-chip"><small>{t("familyCode")}</small><b>{u.roomCode}</b></div>
      </div>

      <div className="cols">
        <div>
          <section className="card">
            <h2>{t("medsSchedule")}</h2>
            {d.meds.length === 0 && <p className="muted">{t("noData")}</p>}
            {d.meds.map((m, i) => {
              const state = m.takenToday ? "taken" : m.time <= nowHM ? "missed" : "pending";
              return (
                <div key={i} className="peer-row">
                  <b style={{ minWidth: "4.5rem", fontSize: "1.2rem" }}>{m.time}</b>
                  <div className="grow">{m.name}</div>
                  <span className={`chip ${state === "missed" ? "amber" : state === "pending" ? "grey" : ""}`}>
                    {state === "taken" ? t("taken") : state === "missed" ? t("missedTag") : t("pendingTag")}
                  </span>
                </div>
              );
            })}
          </section>

          <section className="card">
            <h2>{t("gamePlays")}</h2>
            {d.games.length === 0 && <p className="muted">{t("noData")}</p>}
            {d.games.slice(0, 10).map((g, i) => (
              <div key={i} className="peer-row"><div className="grow">{g.game} <span className="muted">({g.level})</span></div><b>{g.score}/{g.total}</b><span className="muted">{ago(g.at, lang)}</span></div>
            ))}
          </section>
        </div>

        <div>
          <section className="card">
            <h2>{t("history")}</h2>
            {d.health.length === 0 && <p className="muted">{t("noData")}</p>}
            {d.health.slice(0, 12).map((h, i) => (
              <div key={i} className="peer-row">
                <div className="grow">
                  {h.sys !== undefined && <span className="stat"><Icon name="heart" size={16} /> {h.sys}/{h.dia ?? "-"}</span>}
                  {h.sugar !== undefined && <span className="stat"><Icon name="drop" size={16} /> {h.sugar}</span>}
                  {h.sleep !== undefined && <span className="stat"><Icon name="moon" size={16} /> {h.sleep}h</span>}
                  {h.mood && <span className="stat">{["great", "okay", "sad"].includes(h.mood) ? t(h.mood as "great" | "okay" | "sad") : h.mood}</span>}
                </div>
                {h.abnormal && <span className="chip red"><Icon name="alert" size={14} /></span>}
                <span className="muted">{ago(h.at, lang)}</span>
              </div>
            ))}
          </section>

          <section className="card">
            <h2>{t("alerts")}</h2>
            {d.alerts.length === 0 && <p className="muted">{t("noAlerts")}</p>}
            {d.alerts.slice(0, 8).map((a) => (
              <div key={a.id} className="peer-row">
                <div className="grow">{a.note || a.source}</div>
                <span className={`chip ${a.acked ? "" : "red"}`}>{a.acked ? t("ack") : "SOS"}</span>
                <span className="muted">{ago(new Date(a.time).getTime(), lang)}</span>
              </div>
            ))}
          </section>

          <section className="card">
            <h2>{t("account")}</h2>
            <label style={{ marginTop: 0 }}>{t("resetPassword")}</label>
            <div className="pw-row">
              <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t("newPassword")} />
              <button className="primary" onClick={async () => { if (pw && (await patch({ password: pw }, `${t("resetPassword")} ✓`))) setPw(""); }}>{t("save")}</button>
            </div>
            <div className="row" style={{ marginTop: "1rem" }}>
              <button onClick={() => patch({ disabled: !u.disabled }, "✓")}>{u.disabled ? t("enable") : t("disable")}</button>
              <button className="danger" onClick={remove}><Icon name="trash" size={20} /> {t("deleteUser")}</button>
            </div>
            {msg && <p className={msg.ok ? "msg-ok" : "msg-bad"} style={{ textAlign: "left", fontSize: "1.05rem" }}>{msg.text}</p>}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
