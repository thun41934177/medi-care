import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useApp } from "../store";
import { useAuth } from "../lib/auth";
import Logo from "../components/Logo";

/** Sign in, or create a new account. */
export default function Login() {
  const { t, lang, set } = useApp();
  const { user, loading, login, signup } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [room, setRoom] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to={user.isAdmin ? "/admin" : "/home"} replace />;

  const up = mode === "up";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (up && password !== confirm) return setError(t("pwMismatch"));
    setBusy(true);
    const err = up ? await signup({ name, username, password, room }) : await login(username, password);
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

        <div className="seg tabs2" role="tablist">
          <button type="button" className={!up ? "primary" : ""} onClick={() => { setMode("in"); setError(""); }}>{t("signIn")}</button>
          <button type="button" className={up ? "primary" : ""} onClick={() => { setMode("up"); setError(""); }}>{t("createAccount")}</button>
        </div>

        <h1>{up ? t("createAccount") : t("signIn")}</h1>
        <p className="muted">{up ? t("signUpHelp") : t("signInHelp")}</p>

        {up && (
          <>
            <label>{t("fullName")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </>
        )}
        <label>{t("username")}</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" required />
        <label>{t("password")}</label>
        <div className="pw-row">
          <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={up ? "new-password" : "current-password"} required />
          <button type="button" className="small" onClick={() => setShow((v) => !v)}>{show ? t("hidePw") : t("showPw")}</button>
        </div>
        {up && (
          <>
            <label>{t("confirmPassword")}</label>
            <input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            <label>{t("roomOptional")}</label>
            <input value={room} onChange={(e) => setRoom(e.target.value)} />
          </>
        )}

        {error && <p className="msg-bad" role="alert" style={{ textAlign: "left" }}>{error}</p>}
        <button className="primary login-btn" type="submit" disabled={busy}>{busy ? t("loading") : up ? t("createAccount") : t("signIn")}</button>
      </form>
    </div>
  );
}
