import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../store";
import { speak } from "../lib/speech";
import Icon from "../components/Icon";

export default function Sos() {
  const { t, lang } = useApp();
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
    <div className="page" style={{ textAlign: "center", paddingTop: "3rem" }}>
      {step === "idle" && (
        <>
          <button className="sos-orb" onClick={() => setStep("confirm")}>
            <Icon name="alert" size={84} stroke={2} />
            <span style={{ maxWidth: "12rem" }}>{t("sosPress")}</span>
          </button>
        </>
      )}
      {step === "confirm" && (
        <>
          <p className="big">{t("sosConfirm")}</p>
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="danger" style={{ fontSize: "2rem", minWidth: "9rem", minHeight: "6rem" }} onClick={send}>{t("yes")}</button>
            <button style={{ fontSize: "2rem", minWidth: "9rem", minHeight: "6rem" }} onClick={() => setStep("idle")}>{t("no")}</button>
          </div>
        </>
      )}
      {step === "sent" && <p className="big msg-ok"><Icon name="check" size={40} /> {t("sosSent")}</p>}
      {step === "fail" && (
        <>
          <p className="big msg-bad"><Icon name="alert" size={36} /> {t("sosFail")}</p>
          <button className="danger" onClick={send}>{t("tryAgain")}</button>
        </>
      )}
      <p style={{ marginTop: "3rem" }}><Link to="/home"><button><Icon name="home" size={22} /> {t("home")}</button></Link></p>
    </div>
  );
}
