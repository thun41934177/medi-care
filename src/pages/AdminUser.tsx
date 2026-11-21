import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../store";
import { ago } from "../lib/time";
import AdminShell from "../components/AdminShell";
import Icon from "../components/Icon";
import { StatusDot, Condition, type Summary } from "./Admin";

interface Reading { at: number; sys?: number; dia?: number; sugar?: number; sleep?: number; mood?: string; abnormal: boolean }
interface Detail {
  user: Summary;
  meds: { name: string; time: string; takenToday: boolean }[];
  health: Reading[];
  games: { at: number; game: string; level: string; score: number; total: number }[];
  alerts: { id: string; time: string; source: string; note?: string; acked: boolean }[];
}

/** Small line chart of the last readings (oldest on the left). */
function Spark({ values, label, unit }: { values: number[]; label: string; unit: string }) {
  if (values.length === 0) return null;
  const w = 260, h = 70, pad = 6;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [pad + (values.length === 1 ? (w - 2 * pad) / 2 : (i * (w - 2 * pad)) / (values.length - 1)), h - pad - ((v - min) / span) * (h - 2 * pad)]);
  const last = values[values.length - 1];
  return (
    <div className="spark">
      <div className="spark-head"><span>{label}</span><b>{last} {unit}</b></div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={`${label}: ${values.join(", ")}`}>
        <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#1f2050" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 4.5 : 2.5} fill="#1f2050" />)}
      </svg>
      <div className="spark-foot"><span>{min}</span><span>{max}</span></div>
    </div>
  );
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

  async function resetPw() {
    const r = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    const x = await r.json().catch(() => ({}));
    setMsg({ ok: r.ok, text: r.ok ? t("passwordChanged") : x.error || "Error" });
    if (r.ok) setPw("");
  }
  async function remove() {
    if (!window.confirm(t("confirmDelete"))) return;
    const r = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (r.ok) nav("/admin", { replace: true });
    else setMsg({ ok: false, text: (await r.json().catch(() => ({}))).error || "Error" });
  }

  const back = <Link to="/admin"><button className="small"><Icon name="back" size={18} /> {t("backToList")}</button></Link>;
  if (missing) return <AdminShell>{back}<p>Not found.</p></AdminShell>;
  if (!d) return <AdminShell><p className="muted">{t("loading")}</p></AdminShell>;

  const u = d.user;
  const nowHM = new Date().toTimeString().slice(0, 5);
  const latest = d.health[0];
  const chrono = [...d.health].reverse().slice(-20); // oldest -> newest
  const bp = chrono.filter((h) => h.sys !== undefined).map((h) => h.sys as number);
  const sugar = chrono.filter((h) => h.sugar !== undefined).map((h) => h.sugar as number);
  const moodText = (m?: string) => (m && ["great", "okay", "sad"].includes(m) ? t(m as "great" | "okay" | "sad") : m ?? "—");

  return (
    <AdminShell>
      {back}

      <div className={`card profile cond-${u.status}`}>
        <span className="peer-avatar lg">{u.name.slice(0, 1).toUpperCase()}</span>
        <div className="grow">
          <h1 style={{ fontSize: "1.8rem" }}>{u.name}</h1>
          <div className="muted">@{u.username} · {t("room")} {u.room}</div>
          <div style={{ marginTop: ".4rem" }}><StatusDot online={u.online} /> {u.online ? t("online") : u.lastSeen ? ago(u.lastSeen, lang) : t("never")}</div>
        </div>
        <div className="profile-cond"><small>{t("condition")}</small><Condition s={u} /></div>
        <div className="code-chip"><small>{t("familyCode")}</small><b>{u.roomCode}</b></div>
      </div>

      <section className="card">
        <h2>{t("latestVitals")}</h2>
        {!latest ? <p className="muted">{t("noReadingsAdmin")}</p> : (
          <>
            <div className="vitals">
              <div className={`vital ${latest.sys !== undefined && (latest.sys >= 160 || latest.sys < 90 || (latest.dia ?? 0) >= 100 || (latest.dia ?? 99) < 55) ? "bad" : ""}`}><span>{t("bp")}</span><b>{latest.sys !== undefined ? `${latest.sys}/${latest.dia ?? "-"}` : "—"}</b></div>
              <div className={`vital ${latest.sugar !== undefined && (latest.sugar >= 250 || latest.sugar < 70) ? "bad" : ""}`}><span>{t("sugar")}</span><b>{latest.sugar ?? "—"}</b></div>
              <div className={`vital ${latest.sleep !== undefined && latest.sleep < 3 ? "bad" : ""}`}><span>{t("sleep")}</span><b>{latest.sleep !== undefined ? `${latest.sleep} h` : "—"}</b></div>
              <div className={`vital ${latest.mood === "sad" ? "bad" : ""}`}><span>{t("mood")}</span><b>{moodText(latest.mood)}</b></div>
            </div>
            <p className="muted" style={{ margin: ".6rem 0 0" }}>{ago(latest.at, lang)}</p>
          </>
        )}
      </section>

      {(bp.length > 1 || sugar.length > 1) && (
        <section className="card">
          <h2>{t("trends")}</h2>
          <div className="sparks">
            <Spark values={bp} label={t("bpTrend")} unit="mmHg" />
            <Spark values={sugar} label={t("sugarTrend")} unit="mg/dL" />
          </div>
        </section>
      )}

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
                  <span className={`chip ${state === "missed" ? "amber" : state === "pending" ? "grey" : ""}`}>{state === "taken" ? t("taken") : state === "missed" ? t("missedTag") : t("pendingTag")}</span>
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
            {d.health.slice(0, 15).map((h, i) => (
              <div key={i} className="peer-row">
                <div className="grow">
                  {h.sys !== undefined && <span className="stat"><Icon name="heart" size={16} /> {h.sys}/{h.dia ?? "-"}</span>}
                  {h.sugar !== undefined && <span className="stat"><Icon name="drop" size={16} /> {h.sugar}</span>}
                  {h.sleep !== undefined && <span className="stat"><Icon name="moon" size={16} /> {h.sleep}h</span>}
                  {h.mood && <span className="stat">{moodText(h.mood)}</span>}
                </div>
                {h.abnormal && <span className="chip red"><Icon name="alert" size={14} /> {t("reasonVitals")}</span>}
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
              <button className="primary" disabled={pw.length < 4} onClick={resetPw}>{t("save")}</button>
            </div>
            <div style={{ marginTop: "1rem" }}><button className="danger" onClick={remove}><Icon name="trash" size={20} /> {t("deleteUser")}</button></div>
            {msg && <p className={msg.ok ? "msg-ok" : "msg-bad"} style={{ textAlign: "left", fontSize: "1.05rem" }}>{msg.text}</p>}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
