import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db, GameLog } from "../db";
import { useApp } from "../store";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";

interface Alert { id: string; time: string; name: string; room: string; source: string; acked: boolean }

export default function Staff() {
  const { t } = useApp();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [games, setGames] = useState<GameLog[]>([]);

  const load = () => fetch("/api/sos").then((r) => r.json()).then(setAlerts).catch(() => {});
  useEffect(() => {
    load();
    db.games.orderBy("at").reverse().limit(15).toArray().then(setGames);
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  async function ack(id: string) {
    await fetch(`/api/sos/${id}/ack`, { method: "POST" });
    load();
  }

  return (
    <div className="page">
      <div style={{ padding: ".7rem 0" }}><Link to="/home"><button><Icon name="home" size={22} /> {t("home")}</button></Link></div>
      <PageHeader icon="users" title={t("alerts")} color="var(--g-red)" />
      {alerts.length === 0 && <p>{t("noAlerts")}</p>}
      {alerts.map((a) => (
        <div key={a.id} className="card row" style={{ borderColor: a.acked ? "var(--line)" : "var(--red)" }}>
          <div className="grow">
            <b>{a.name}</b> · {t("room")} {a.room} ({a.source})<br />
            <small>{new Date(a.time).toLocaleString()}</small>
          </div>
          {a.acked ? <span className="chip"><Icon name="check" size={16} /></span> : <button className="danger" onClick={() => ack(a.id)}>{t("ack")}</button>}
        </div>
      ))}
      <h2>{t("gamePlays")}</h2>
      {games.map((g) => (
        <div key={g.id} className="card"><small>{new Date(g.at).toLocaleString()}</small><br />{g.game} ({g.level}): {g.score}/{g.total}</div>
      ))}
    </div>
  );
}
