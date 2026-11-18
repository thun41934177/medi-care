import { useEffect, useRef, useState } from "react";
import { db, Med, todayStr } from "../db";
import { useApp } from "../store";
import { speak } from "./speech";
import Icon from "../components/Icon";

const hhmm = () => new Date().toTimeString().slice(0, 5);

export default function ReminderWatcher() {
  const { t, lang } = useApp();
  const [due, setDue] = useState<Med | null>(null);
  const snoozed = useRef<Record<number, number>>({});

  useEffect(() => {
    async function check() {
      if (due) return;
      const now = hhmm();
      const meds = await db.meds.toArray();
      const doses = await db.doses.where("date").equals(todayStr()).toArray();
      for (const m of meds) {
        if (m.time > now) continue; // not yet due today
        if (doses.some((d) => d.medId === m.id)) continue;
        if ((snoozed.current[m.id!] ?? 0) > Date.now()) continue;
        setDue(m);
        speak(`${t("timeForMed")}: ${m.name}`, lang);
        fetch("/api/robot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "speak", text: `${t("timeForMed")}: ${m.name}` }) }).catch(() => {});
        return;
      }
    }
    check();
    const id = setInterval(check, 20_000);
    return () => clearInterval(id);
  }, [due, lang, t]);

  if (!due) return null;

  async function answer(status: "taken" | "skipped") {
    if (status === "taken") await db.doses.add({ medId: due!.id!, date: todayStr(), status });
    else snoozed.current[due!.id!] = Date.now() + 10 * 60_000; // ask again in 10 min
    window.speechSynthesis?.cancel();
    setDue(null);
  }

  return (
    <div className="alarm">
      <div className="card">
        <div className="alarm-ico"><Icon name="pill" size={48} /></div>
        <p style={{ margin: 0 }}>{t("timeForMed")}</p>
        <p style={{ fontWeight: 900, fontSize: "2.2rem", margin: ".3rem 0 1.2rem" }}>{due.name} · {due.time}</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="good" style={{ fontSize: "1.5rem", minHeight: "4.5rem" }} onClick={() => answer("taken")}><Icon name="check" size={26} /> {t("taken")}</button>
          <button style={{ fontSize: "1.5rem", minHeight: "4.5rem" }} onClick={() => answer("skipped")}>{t("notYet")}</button>
        </div>
      </div>
    </div>
  );
}
