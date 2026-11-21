import { useEffect, useState } from "react";
import { db, Med, todayStr } from "../db";
import { useApp } from "../store";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import { syncMeds, syncDose } from "../lib/sync";
import Empty from "../components/Empty";

export default function Meds() {
  const { t } = useApp();
  const [meds, setMeds] = useState<Med[]>([]);
  const [taken, setTaken] = useState<Set<number>>(new Set());
  const [name, setName] = useState("");
  const [time, setTime] = useState("08:00");
  const [weekTaken, setWeekTaken] = useState(0);

  async function refresh() {
    setMeds((await db.meds.toArray()).sort((a, b) => a.time.localeCompare(b.time)));
    const d = await db.doses.where("date").equals(todayStr()).toArray();
    setTaken(new Set(d.filter((x) => x.status === "taken").map((x) => x.medId)));
    const since = new Date(); since.setDate(since.getDate() - 6);
    const from = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-${String(since.getDate()).padStart(2, "0")}`;
    const week = await db.doses.where("date").aboveOrEqual(from).toArray();
    setWeekTaken(new Set(week.filter((x) => x.status === "taken").map((x) => `${x.medId}|${x.date}`)).size);
  }
  useEffect(() => { refresh(); }, []);

  async function add() {
    if (!name.trim()) return;
    await db.meds.add({ name: name.trim(), time });
    syncMeds();
    setName("");
    refresh();
  }
  async function markTaken(m: Med) {
    await db.doses.add({ medId: m.id!, date: todayStr(), status: "taken" });
    syncDose(m.name, m.time, todayStr(), "taken");
    refresh();
  }
  async function undo(m: Med) {
    await db.doses.where("date").equals(todayStr()).filter((x) => x.medId === m.id).delete();
    refresh();
  }
  async function remove(m: Med) {
    await db.meds.delete(m.id!);
    syncMeds();
    refresh();
  }

  const done = meds.filter((m) => taken.has(m.id!)).length;
  const nowHM = new Date().toTimeString().slice(0, 5);
  const pending = meds.filter((m) => !taken.has(m.id!));
  const next = pending.find((m) => m.time >= nowHM) ?? pending[0];
  const adherence = meds.length ? Math.min(100, Math.round((weekTaken / (meds.length * 7)) * 100)) : 0;

  return (
    <div className="page">
      <PageHeader icon="pill" title={t("meds")} color="var(--g-purple)" sub={meds.length ? `${done}/${meds.length} ${t("today")}` : undefined} />
      {meds.length > 0 && <div className="progress"><i style={{ width: `${(done / meds.length) * 100}%` }} /></div>}

      {meds.length > 0 && (
        <div className="stats" style={{ marginBottom: "1rem" }}>
          <div className="stat-card"><b>{adherence}%</b><span>{t("adherence7d")}</span></div>
          <div className="stat-card"><b>{next ? next.time : "✓"}</b><span>{next ? `${t("nextDose")} · ${next.name}` : t("allDoneToday")}</span></div>
        </div>
      )}

      <div className="cols"><div>
      {meds.length === 0 && <Empty icon="pill" title={t("noMeds")} hint={t("noMedsHint")} />}
      {meds.map((m) => (
        <div className="card med-row" key={m.id} style={taken.has(m.id!) ? { opacity: .75 } : undefined}>
          <span className="med-time">{m.time}</span>
          <div className="grow" style={{ fontSize: "1.25rem", fontWeight: 800 }}>{m.name}</div>
          {taken.has(m.id!)
            ? <><span className="chip"><Icon name="check" size={18} /> {t("taken")}</span><button className="small ghost" onClick={() => undo(m)}>{t("undo")}</button></>
            : <button className="good" onClick={() => markTaken(m)}><Icon name="check" size={22} /> {t("taken")}</button>}
          <button className="small icon-btn ghost" onClick={() => remove(m)} aria-label={t("delete")}><Icon name="trash" size={20} /></button>
        </div>
      ))}

      </div><div>
      <div className="card">
        <h2>{t("addMed")}</h2>
        <label>{t("medName")}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <label>{t("medTime")}</label>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <div style={{ marginTop: "1rem" }}><button className="primary" onClick={add}><Icon name="plus" size={22} /> {t("add")}</button></div>
      </div>
      </div></div>
    </div>
  );
}
