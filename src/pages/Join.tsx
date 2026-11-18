import { useState } from "react";
import { useParams } from "react-router-dom";
import { useApp } from "../store";
import { useRoom } from "../lib/room";
import RoomView from "../components/RoomView";
import Logo from "../components/Logo";

/** Family member's page (opened from the invite link on their own phone). */
export default function Join() {
  const { code = "" } = useParams();
  const { t, lang, set } = useApp();
  const { connect, role } = useRoom();
  const [name, setName] = useState(() => { try { return localStorage.getItem("familyName") || ""; } catch { return ""; } });

  function join() {
    const n = name.trim();
    if (!n) return;
    try { localStorage.setItem("familyName", n); } catch { /* ignore */ }
    connect({ room: code, role: "family", name: n });
  }

  return (
    <div className="page" style={{ paddingTop: "1.5rem" }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
        <span className="brandmark"><Logo size={30} color="#1f2050" /> MEDICARE</span>
        <div className="seg">
          <button className={lang === "en" ? "primary" : ""} onClick={() => set({ lang: "en" })}>EN</button>
          <button className={lang === "th" ? "primary" : ""} onClick={() => set({ lang: "th" })}>ไทย</button>
        </div>
      </div>

      {role !== "family" ? (
        <div className="card">
          <h2>{t("joinTitle")}</h2>
          <p className="muted">{t("joinHelp")}</p>
          <label>{t("yourName")}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && join()} />
          <div style={{ marginTop: "1rem" }}><button className="primary" style={{ width: "100%", fontSize: "1.2rem" }} onClick={join}>{t("joinBtn")}</button></div>
        </div>
      ) : (
        <RoomView me="family" />
      )}
    </div>
  );
}
