import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useApp } from "../store";
import { useAuth } from "../lib/auth";
import Logo from "../components/Logo";

/** Sign-in screen. On the very first start it asks for the administrator account instead. */
export default function Login() {
  const { t, lang, set } = useApp();
  const { user, loading, hasAdmin, login, setup } = useAuth();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to={user.role === "admin" ? "/admin" : "/home"} replace />;

  const first = !hasAdmin;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (first && password !== confirm) return setError(t("pwMismatch"));
    setBusy(true);
    const err = first ? await setup(name, username, password) : await login(username, password);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div className="login">
      <div className="login-top">
        <div className="seg lang-light">
          <button className={lang === "en" ? "primary" : ""} onClick={() => set({ lang: "en" })}>EN</button>
          <button className={lang === "th" ? "primary" : ""} onClick={() => set({ lang: "th" })}>ไทย</button>
        </div>
      </div>

      <form className="login-card" onSubmit={submit}>
        <div className="login-brand"><Logo size={44} color="#1f2050" /><span>MEDICARE</span></div>
        <h1>{first ? t("setupTitle") : t("signIn")}</h1>
        <p className="muted">{first ? t("setupHelp") : t("signInHelp")}</p>

        {first && (
          <>
            <label>{t("fullName")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </>
        )}
        <label>{t("username")}</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" required />
        <label>{t("password")}</label>
        <div className="pw-row">
          <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={first ? "new-password" : "current-password"} required />
          <button type="button" className="small" onClick={() => setShow((v) => !v)}>{show ? t("hidePw") : t("showPw")}</button>
        </div>
        {first && (
          <>
            <label>{t("confirmPassword")}</label>
            <input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </>
        )}

        {error && <p className="msg-bad" role="alert" style={{ textAlign: "left" }}>{error}</p>}
        <button className="primary login-btn" type="submit" disabled={busy}>{busy ? t("loading") : first ? t("createAdminBtn") : t("signIn")}</button>
      </form>
    </div>
  );
}
