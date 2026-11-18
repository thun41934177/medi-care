import { Link } from "react-router-dom";
import { useApp } from "../store";
import { useAuth } from "../lib/auth";
import Logo from "./Logo";
import Icon from "./Icon";

/** Frame for every administrator page: top bar with the signed-in admin and sign out. */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { t, lang, set } = useApp();
  const { user, logout } = useAuth();
  return (
    <div className="admin">
      <header className="admin-bar">
        <Link to="/admin" className="admin-brand"><Logo size={30} color="#fff" /><span>MEDICARE</span><em>{t("adminConsole")}</em></Link>
        <span className="grow" />
        <div className="seg lang-dark">
          <button className={lang === "en" ? "on" : ""} onClick={() => set({ lang: "en" })}>EN</button>
          <button className={lang === "th" ? "on" : ""} onClick={() => set({ lang: "th" })}>ไทย</button>
        </div>
        <span className="admin-who"><Icon name="users" size={18} /> {user?.name}</span>
        <button className="admin-out" onClick={logout}>{t("signOut")}</button>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
