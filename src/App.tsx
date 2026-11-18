import { Routes, Route, NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "./store";
import Icon, { IconName } from "./components/Icon";
import Logo from "./components/Logo";
import type { Key } from "./i18n";
import Start from "./pages/Start";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Live from "./pages/Live";
import Friend from "./pages/Friend";
import Activities from "./pages/Activities";
import Family from "./pages/Family";
import Join from "./pages/Join";
import CallOverlay from "./components/CallOverlay";
import Sidebar from "./components/Sidebar";
import Meds from "./pages/Meds";
import Health from "./pages/Health";
import Sos from "./pages/Sos";
import Staff from "./pages/Staff";
import Settings from "./pages/Settings";
import Games from "./pages/Games";
import ReminderWatcher from "./lib/ReminderWatcher";

const TABS: { to: string; icon: IconName; label: Key }[] = [
  { to: "/home", icon: "home", label: "home" },
  { to: "/chat", icon: "chat", label: "talk" },
  { to: "/meds", icon: "pill", label: "meds" },
  { to: "/health", icon: "heart", label: "health" },
  { to: "/games", icon: "game", label: "games" },
];

export default function App() {
  const { t, lang, set } = useApp();
  const loc = useLocation();
  const nav = useNavigate();
  const showChrome = !["/", "/home", "/modes", "/sos", "/staff", "/live"].includes(loc.pathname) && !loc.pathname.startsWith("/join");
  const isHome = ["/home", "/friend", "/activities"].includes(loc.pathname);

  return (
    <>
      <ReminderWatcher />
      <CallOverlay />
      {showChrome && (
        <div className="appbar">
          {!isHome && <button className="icon-btn" onClick={() => nav(-1)} aria-label={t("back")}><Icon name="back" /></button>}
          <span className="brandmark"><Logo size={28} color="#1f2050" /> MEDICARE</span>
          <span className="grow" />
          <div className="seg">
            <button className={lang === "en" ? "primary" : ""} onClick={() => set({ lang: "en" })}>EN</button>
            <button className={lang === "th" ? "primary" : ""} onClick={() => set({ lang: "th" })}>ไทย</button>
          </div>
          <Link to="/settings"><button className="icon-btn" aria-label={t("settings")}><Icon name="gear" /></button></Link>
        </div>
      )}
      {showChrome && <Sidebar />}
      <div className={showChrome ? "has-chrome" : ""}>
      <Routes>
        <Route path="/" element={<Start />} />
        <Route path="/home" element={<Home />} />
        <Route path="/modes" element={<Home change />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/live" element={<Live />} />
        <Route path="/friend" element={<Friend />} />
        <Route path="/family" element={<Family />} />
        <Route path="/join/:code" element={<Join />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/meds" element={<Meds />} />
        <Route path="/health" element={<Health />} />
        <Route path="/games" element={<Games />} />
        <Route path="/sos" element={<Sos />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      </div>
      {showChrome && (
        <>
          <Link to="/sos"><button className="danger sos-fab"><Icon name="alert" /> {t("sos")}</button></Link>
          <nav className="tabbar">
            <div className="tabbar-inner">
              {TABS.map((x) => (
                <NavLink key={x.to} to={x.to} className={({ isActive }) => `tab${isActive ? " active" : ""}`}>
                  <Icon name={x.icon} size={28} />
                  {t(x.label)}
                </NavLink>
              ))}
            </div>
          </nav>
        </>
      )}
    </>
  );
}
