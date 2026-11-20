import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../store";
import { speak } from "../lib/speech";
import Icon from "../components/Icon";
import Logo from "../components/Logo";

/** Emergency screen: one big button, a confirmation step, then a clear "help is coming" result. */
export default function Sos() {
  const { t, lang, name, room } = useApp();
  const [step, setStep] = useState<"idle" | "confirm" | "sent" | "fail">("idle");

  async function send() {
    try {
      const r = await fetch("/api/sos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!r.ok) throw new Error();
      setStep("sent");
      speak(t("sosSent"), lang);
    } catch {
      setStep("fail");
      speak(t("sosFail"), lang);
    }
  }

  return (
    <div className="sos-page">
      <header className="sos-head">
        <Link to="/home" className="sos-back"><Icon name="back" size={20} /> {t("home")}</Link>
        <span className="brandmark"><Logo size={26} color="#1f2050" /><span>MEDICARE</span></span>
      </header>

      <main className="sos-main">
        <div className="sos-who"><Icon name="users" size={20} /> <b>{name}</b> <span>· {t("room")} {room}</span></div>

        {step === "idle" && (
          <>
            <h1>{t("sosTitle")}</h1>
            <p className="muted sos-lead">{t("sosExplain")}</p>
            <button className="sos-orb" onClick={() => setStep("confirm")}>
              <Icon name="alert" size={72} stroke={2} />
              <span>{t("sosPress")}</span>
            </button>
          </>
        )}

        {step === "confirm" && (
          <>
            <h1>{t("sosConfirm")}</h1>
            <div className="sos-confirm">
              <button className="danger" onClick={send}>{t("yes")}</button>
              <button onClick={() => setStep("idle")}>{t("no")}</button>
            </div>
          </>
        )}

        {step === "sent" && (
          <div className="sos-result ok">
            <span className="sos-badge"><Icon name="check" size={44} stroke={2.6} /></span>
            <h1>{t("sosSent")}</h1>
            <p className="muted">{t("sosNotified")}</p>
            <Link to="/home"><button className="primary"><Icon name="home" size={22} /> {t("home")}</button></Link>
          </div>
        )}

        {step === "fail" && (
          <div className="sos-result bad">
            <span className="sos-badge"><Icon name="alert" size={44} /></span>
            <h1>{t("sosFail")}</h1>
            <button className="danger" onClick={send}>{t("tryAgain")}</button>
          </div>
        )}
      </main>
    </div>
  );
}
