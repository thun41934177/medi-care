import { useEffect, useState } from "react";
import { db, Med, todayStr } from "../db";
import { useApp } from "../store";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";

export default function Meds() {
  const { t } = useApp();
  const [meds, setMeds] = useState<Med[]>([]);
  const [taken, setTaken] = useState<Set<number>>(new Set());
  const [name, setName] = useState("");
  const [time, setTime] = useState("08:00");

  async function refresh() {
    setMeds((await db.meds.toArray()).sort((a, b) => a.time.localeCompare(b.time)));
    const d = await db.doses.where("date").equals(todayStr()).toArray();
    setTaken(new Set(d.filter((x) => x.status === "taken").map((x) => x.medId)));
  }
  useEffect(() => { refresh(); }, []);

  async function add() {
    if (!name.trim()) return;
    await db.meds.add({ name: name.trim(), time });
    setName("");
    refresh();
  }
  async function markTaken(m: Med) {
    await db.doses.add({ medId: m.id!, date: todayStr(), status: "taken" });
    refresh();
  }
  async function remove(m: Med) {
    await db.meds.delete(m.id!);
    refresh();
  }

  const done = meds.filter((m) => taken.has(m.id!)).length;

  return (
    <div className="page">
      <PageHeader icon="pill" title={t("meds")} color="var(--g-purple)" sub={meds.length ? `${done}/${meds.length} ${t("today")}` : undefined} />
      {meds.length > 0 && <div className="progress"><i style={{ width: `${(done / meds.length) * 100}%` }} /></div>}

      <div className="cols"><div>
      {meds.length === 0 && <div className="card empty">{t("noMeds")}</div>}
      {meds.map((m) => (
        <div className="card med-row" key={m.id} style={taken.has(m.id!) ? { opacity: .75 } : undefined}>
          <span className="med-time">{m.time}</span>
          <div className="grow" style={{ fontSize: "1.25rem", fontWeight: 800 }}>{m.name}</div>
          {taken.has(m.id!)
            ? <span className="chip"><Icon name="check" size={18} /> {t("taken")}</span>
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
