import { useEffect, useMemo, useState } from "react";
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

type Range = 7 | 30 | 0;
const DAY = 86_400_000;
const avg = (xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => x !== undefined);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined;
};

/** Simple dependency-free SVG line chart of systolic / diastolic pressure (oldest on the left). */
function BpChart({ logs, t }: { logs: HealthLog[]; t: ReturnType<typeof useApp>["t"] }) {
  const pts = logs.filter((l) => l.sys !== undefined && l.dia !== undefined).slice().reverse();
  if (pts.length < 2) return <p className="muted">{t("notEnoughData")}</p>;
  const W = 560, H = 190, P = { l: 36, r: 12, t: 12, b: 22 };
  const vals = pts.flatMap((p) => [p.sys!, p.dia!]);
  const lo = Math.floor((Math.min(...vals) - 10) / 10) * 10, hi = Math.ceil((Math.max(...vals) + 10) / 10) * 10;
  const x = (i: number) => P.l + (i / (pts.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const line = (k: "sys" | "dia") => pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]!).toFixed(1)}`).join(" ");
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={t("trend")}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={P.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{v}</text>
          </g>
        ))}
        <path d={line("sys")} fill="none" stroke="var(--navy)" strokeWidth="2.5" />
        <path d={line("dia")} fill="none" stroke="var(--green)" strokeWidth="2.5" strokeDasharray="6 4" />
        {pts.map((p, i) => (
          <g key={p.id}>
            <circle cx={x(i)} cy={y(p.sys!)} r="3.5" fill="var(--navy)" />
            <circle cx={x(i)} cy={y(p.dia!)} r="3.5" fill="var(--green)" />
          </g>
        ))}
      </svg>
      <div className="legend"><span><i style={{ background: "var(--navy)" }} />{t("systolic")}</span><span><i className="dash" />{t("diastolic")}</span></div>
    </div>
  );
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
  const [range, setRange] = useState<Range>(30);

  const refresh = async () => setLogs(await db.health.orderBy("at").reverse().toArray());
  useEffect(() => { refresh(); }, []);

  const shown = useMemo(() => (range ? logs.filter((l) => l.at >= Date.now() - range * DAY) : logs), [logs, range]);
  const mean = useMemo(() => ({ sys: avg(shown.map((l) => l.sys)), dia: avg(shown.map((l) => l.dia)), sugar: avg(shown.map((l) => l.sugar)), sleep: avg(shown.map((l) => l.sleep)) }), [shown]);

  async function save() {
    const n = (s: string) => (s === "" ? undefined : Number(s));
    const entry: HealthLog = { at: Date.now(), sys: n(sys), dia: n(dia), sugar: n(sugar), sleep: n(sleep), mood: mood || undefined };
    if (entry.sys === undefined && entry.dia === undefined && entry.sugar === undefined && entry.sleep === undefined && !entry.mood) return;
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

  async function remove(id: number) { await db.health.delete(id); refresh(); }

  function exportCsv() {
    const rows = [["date", "systolic", "diastolic", "sugar_mg_dl", "sleep_hours", "mood"], ...logs.slice().reverse().map((h) => [new Date(h.at).toISOString(), h.sys ?? "", h.dia ?? "", h.sugar ?? "", h.sleep ?? "", h.mood ?? ""])];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `health-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const f = (v?: number, d = 0) => (v === undefined ? "—" : v.toFixed(d));

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
      <div className="row" style={{ justifyContent: "space-between", marginBottom: ".6rem" }}>
        <div className="seg">
          {([[7, t("last7d")], [30, t("last30d")], [0, t("allTime")]] as [Range, string][]).map(([r, l]) => (
            <button key={r} className={range === r ? "primary" : ""} onClick={() => setRange(r)}>{l}</button>
          ))}
        </div>
        <button className="small" onClick={exportCsv} disabled={logs.length === 0}>{t("exportCsv")}</button>
      </div>

      {shown.length > 0 && (
        <>
          <div className="stats" style={{ marginBottom: "1rem" }}>
            <div className="stat-card"><b>{f(mean.sys)}/{f(mean.dia)}</b><span>{t("average")} · {t("bp")}</span></div>
            <div className="stat-card"><b>{f(mean.sugar)}</b><span>{t("average")} · {t("sugar")}</span></div>
            <div className="stat-card"><b>{f(mean.sleep, 1)}</b><span>{t("average")} · {t("sleep")}</span></div>
          </div>
          <div className="card"><h2 style={{ marginTop: 0 }}>{t("trend")}</h2><BpChart logs={shown} t={t} /></div>
        </>
      )}

      <h2>{t("history")}</h2>
      {shown.length === 0 && <Empty icon="heart" title={t("noReadings")} hint={t("noReadingsHint")} />}
      {shown.map((h) => (
        <div className="card" key={h.id} style={outOfRange(h) ? { borderColor: "var(--red)", borderWidth: 2 } : undefined}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <small className="muted">{new Date(h.at).toLocaleString(lang === "th" ? "th-TH" : undefined)}</small>
            <span className="row" style={{ gap: ".4rem" }}>
              {outOfRange(h)
                ? <span className="chip red"><Icon name="alert" size={16} /> {t("needsCheck")}</span>
                : <span className="chip"><Icon name="check" size={16} /> {t("normal")}</span>}
              <button className="small icon-btn ghost" onClick={() => remove(h.id!)} aria-label={t("delete")}><Icon name="trash" size={18} /></button>
            </span>
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
