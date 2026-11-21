import { useEffect, useState } from "react";
import { db, HealthLog } from "../db";
import { useApp } from "../store";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import { syncHealth } from "../lib/sync";
import Empty from "../components/Empty";

function outOfRange(h: HealthLog) {
  return (h.sys !== undefined && (h.sys >= 160 || h.sys < 90)) ||
    (h.dia !== undefined && (h.dia >= 100 || h.dia < 55)) ||
    (h.sugar !== undefined && (h.sugar >= 250 || h.sugar < 70)) ||
    (h.sleep !== undefined && h.sleep < 3);
}

export default function Health() {
  const { t, lang } = useApp();
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [sugar, setSugar] = useState("");
  const [sleep, setSleep] = useState("");
  const [mood, setMood] = useState("");
  const [warn, setWarn] = useState(false);

  const refresh = async () => setLogs((await db.health.orderBy("at").reverse().limit(20).toArray()));
  useEffect(() => { refresh(); }, []);

  async function save() {
    const n = (s: string) => (s === "" ? undefined : Number(s));
    const entry: HealthLog = { at: Date.now(), sys: n(sys), dia: n(dia), sugar: n(sugar), sleep: n(sleep), mood: mood || undefined };
    await db.health.add(entry);
    syncHealth(entry);
    const bad = outOfRange(entry);
    setWarn(bad);
    if (bad) {
      fetch("/api/sos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: "Abnormal health reading" }) }).catch(() => {});
    }
    setSys(""); setDia(""); setSugar(""); setSleep(""); setMood("");
    refresh();
  }

  return (
    <div className="page">
      <PageHeader icon="heart" title={t("health")} color="var(--g-green)" />
      <div className="cols"><div>
      <div className="card">
        <label style={{ marginTop: 0 }}><Icon name="heart" size={18} /> {t("bp")}</label>
        <div className="row">
          <input className="grow" type="number" inputMode="numeric" placeholder="120" value={sys} onChange={(e) => setSys(e.target.value)} />
          <b style={{ fontSize: "1.6rem" }}>/</b>
          <input className="grow" type="number" inputMode="numeric" placeholder="80" value={dia} onChange={(e) => setDia(e.target.value)} />
        </div>
        <label><Icon name="drop" size={18} /> {t("sugar")}</label>
        <input type="number" inputMode="numeric" value={sugar} onChange={(e) => setSugar(e.target.value)} />
        <label><Icon name="moon" size={18} /> {t("sleep")}</label>
        <input type="number" inputMode="decimal" value={sleep} onChange={(e) => setSleep(e.target.value)} />
        <label>{t("mood")}</label>
        <div className="row">
          {([["great", t("great")], ["okay", t("okay")], ["sad", t("sad")]] as [string, string][]).map(([k, l]) => (
            <button key={k} className={`grow ${mood === k ? "primary" : ""}`} onClick={() => setMood(k)}>{mood === k && <Icon name="check" size={20} />} {l}</button>
          ))}
        </div>
        <div style={{ marginTop: "1.1rem" }}><button className="good" style={{ width: "100%", fontSize: "1.2rem" }} onClick={save}><Icon name="check" size={22} /> {t("save")}</button></div>
        {warn && <p className="msg-bad"><Icon name="alert" size={20} /> {t("outOfRange")}</p>}
      </div>

      </div><div>
      <h2 style={{ marginTop: 0 }}>{t("history")}</h2>
      {logs.length === 0 && <Empty icon="heart" title={t("noReadings")} hint={t("noReadingsHint")} />}
      {logs.map((h) => (
        <div className="card" key={h.id} style={outOfRange(h) ? { borderColor: "var(--red)", borderWidth: 2 } : undefined}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <small className="muted">{new Date(h.at).toLocaleString(lang === "th" ? "th-TH" : undefined)}</small>
            {outOfRange(h) && <span className="chip red"><Icon name="alert" size={16} /> !</span>}
          </div>
          <div style={{ marginTop: ".3rem", fontSize: "1.15rem" }}>
            {h.sys !== undefined && <span className="stat"><Icon name="heart" size={18} /> {h.sys}/{h.dia ?? "-"}</span>}
            {h.sugar !== undefined && <span className="stat"><Icon name="drop" size={18} /> {h.sugar}</span>}
            {h.sleep !== undefined && <span className="stat"><Icon name="moon" size={18} /> {h.sleep}h</span>}
            {h.mood && <span className="stat">{["great", "okay", "sad"].includes(h.mood) ? t(h.mood as "great" | "okay" | "sad") : h.mood}</span>}
          </div>
        </div>
      ))}
      </div></div>
    </div>
  );
}
