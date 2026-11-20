import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../store";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import Empty from "../components/Empty";

interface Alert { id: string; time: string; name: string; room: string; source: string; note?: string; acked: boolean }

/** Caregivers: see who pressed SOS and mark it as handled. */
export default function Staff() {
  const { t, lang } = useApp();
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const load = () => fetch("/api/alerts").then((r) => r.json()).then((d) => Array.isArray(d) && setAlerts(d)).catch(() => {});
  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, []);

  async function ack(id: string) {
    await fetch(`/api/alerts/${id}/ack`, { method: "POST" });
    load();
  }

  return (
    <div className="page">
      <div style={{ padding: ".7rem 0" }}><Link to="/home"><button><Icon name="home" size={22} /> {t("home")}</button></Link></div>
      <PageHeader icon="users" title={t("alerts")} color="var(--navy)" sub={t("updatedLive")} />
      {alerts.length === 0 && <Empty icon="check" title={t("noAlerts")} hint={t("noAlertsHint")} />}
      {alerts.map((a) => (
        <div key={a.id} className="card row" style={{ borderColor: a.acked ? "var(--line)" : "var(--red)", borderWidth: a.acked ? 1 : 2 }}>
          <div className="grow">
            <b>{a.name}</b> · {t("room")} {a.room}{a.note ? ` · ${a.note}` : ""}<br />
            <small className="muted">{new Date(a.time).toLocaleString(lang === "th" ? "th-TH" : undefined)} ({a.source})</small>
          </div>
          {a.acked ? <span className="chip"><Icon name="check" size={16} /></span> : <button className="danger" onClick={() => ack(a.id)}>{t("ack")}</button>}
        </div>
      ))}
    </div>
  );
}
