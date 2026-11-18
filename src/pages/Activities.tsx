import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db, Med, todayStr } from "../db";
import { useApp } from "../store";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";

/** Mode 2: activity program (reminders for medicines and health checks) */
export default function Activities() {
  const { t } = useApp();
  const [next, setNext] = useState<Med | "done" | "none">("none");

  useEffect(() => {
    (async () => {
      const meds = (await db.meds.toArray()).sort((a, b) => a.time.localeCompare(b.time));
      if (!meds.length) return setNext("none");
      const taken = new Set((await db.doses.where("date").equals(todayStr()).toArray()).map((d) => d.medId));
      const pending = meds.filter((m) => !taken.has(m.id!));
      setNext(pending.length ? pending[0] : "done");
    })();
  }, []);

  return (
    <div className="page">
      <Link to="/modes" className="change-mode"><Icon name="back" size={18} /> {t("changeMode")}</Link>
      <PageHeader icon="clock" title={t("modePlan")} color="var(--g-purple)" sub={t("modePlanDesc")} />

      <Link to="/meds" style={{ textDecoration: "none", color: "inherit" }}>
        <div className="card next-med">
          <span className="badge"><Icon name="pill" size={26} /></span>
          <div className="grow">
            <div className="muted">{t("nextMed")}</div>
            <div style={{ fontWeight: 900, fontSize: "1.25rem" }}>
              {next === "none" ? t("noMedsSet") : next === "done" ? t("allMedsDone") : `${next.time} · ${next.name}`}
            </div>
          </div>
          <Icon name="arrow" size={26} />
        </div>
      </Link>

      <div className="grid2" style={{ marginTop: "1rem" }}>
        <Link to="/meds" className="tile" data-tone="purple">
          <span className="ico"><Icon name="pill" size={32} /></span>{t("meds")}
        </Link>
        <Link to="/health" className="tile" data-tone="green">
          <span className="ico"><Icon name="heart" size={32} /></span>{t("health")}
        </Link>
      </div>
    </div>
  );
}
