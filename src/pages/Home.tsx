import { Link, Navigate } from "react-router-dom";
import { useApp, localDate, Mode } from "../store";
import Icon, { IconName } from "../components/Icon";

/** "Select Mode" screen, built from design picture 2 (public/modes.jpg is the photo cut from it). */
export default function Home({ change = false }: { change?: boolean }) {
  const { t, lang, name, set, mode, modeDay } = useApp();
  // Mode is asked once a day: after it is chosen, Home goes straight to that mode's page.
  if (!change && mode && modeDay === localDate()) return <Navigate to={mode === "friend" ? "/friend" : "/activities"} replace />;
  const h = new Date().getHours();
  const hello = h < 12 ? t("goodMorning") : h < 17 ? t("goodAfternoon") : t("goodEvening");

  const cards: { to: string; icon: IconName; title: string; desc: string; hot?: boolean; mode?: Mode }[] = [
    { to: "/friend", icon: "heart", title: t("modeFriend"), desc: t("modeFriendDesc"), mode: "friend" },
    { to: "/activities", icon: "clock", title: t("modePlan"), desc: t("modePlanDesc"), mode: "plan" },
    { to: "/sos", icon: "alert", title: t("modeHelp"), desc: t("modeHelpDesc"), hot: true },
  ];

  return (
    <div className="modes">
      <div className="modes-top">
        <div className="seg">
          <button className={lang === "en" ? "primary" : ""} onClick={() => set({ lang: "en" })}>EN</button>
          <button className={lang === "th" ? "primary" : ""} onClick={() => set({ lang: "th" })}>ไทย</button>
        </div>
        <Link to="/settings"><button className="icon-btn" aria-label={t("settings")}><Icon name="gear" /></button></Link>
      </div>

      <div className="modes-head">
        <div>
          <h1 className="modes-title">{t("selectMode")}</h1>
          <p className="modes-hello">{hello}, <b>{name}</b></p>
        </div>
        <img className="modes-photo" src="/modes.jpg" alt="" />
      </div>

      <div className="mode-cards">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="mode-card" onClick={() => c.mode && set({ mode: c.mode, modeDay: localDate() })}>
            <span className={`mode-ico${c.hot ? " hot" : ""}`}><Icon name={c.icon} size={34} /></span>
            <h2>{c.title}</h2>
            <p>{c.desc}</p>
            <span className="mode-go"><Icon name="arrow" size={28} /></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
