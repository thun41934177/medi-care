import { Link, NavLink } from "react-router-dom";
import { useApp } from "../store";
import { useRoom } from "../lib/room";
import Icon, { IconName } from "./Icon";
import Logo from "./Logo";
import type { Key } from "../i18n";

const ITEMS: { to: string; icon: IconName; label: Key }[] = [
  { to: "/home", icon: "home", label: "home" },
  { to: "/live", icon: "phone", label: "callAi" },
  { to: "/chat", icon: "chat", label: "talk" },
  { to: "/family", icon: "video", label: "family" },
  { to: "/meds", icon: "pill", label: "meds" },
  { to: "/health", icon: "heart", label: "health" },
  { to: "/games", icon: "game", label: "games" },
];

/** Navigation for iPad / Mac screens (shown from 820px wide; the phone layout uses the bottom tab bar). */
export default function Sidebar() {
  const { t, lang, set } = useApp();
  const { unread } = useRoom();
  return (
    <aside className="sidebar">
      <Link to="/home" className="side-brand">
        <Logo size={34} color="#fff" />
        <span>MEDICARE</span>
      </Link>

      <nav className="side-nav">
        {ITEMS.map((x) => (
          <NavLink key={x.to} to={x.to} className={({ isActive }) => `side-link${isActive ? " active" : ""}`}>
            <Icon name={x.icon} size={26} />
            <span>{t(x.label)}</span>
            {x.to === "/family" && unread > 0 && <b className="badge-dot">{unread}</b>}
          </NavLink>
        ))}
      </nav>

      <div className="side-bottom">
        <Link to="/sos" className="side-sos"><Icon name="alert" size={26} /><span>{t("sos")}</span></Link>
        <div className="side-lang">
          <button className={lang === "en" ? "on" : ""} onClick={() => set({ lang: "en" })}>EN</button>
          <button className={lang === "th" ? "on" : ""} onClick={() => set({ lang: "th" })}>ไทย</button>
        </div>
        <Link to="/modes" className="side-link"><Icon name="home" size={26} /><span>{t("changeMode")}</span></Link>
        <Link to="/settings" className="side-link"><Icon name="gear" size={26} /><span>{t("settings")}</span></Link>
      </div>
    </aside>
  );
}
