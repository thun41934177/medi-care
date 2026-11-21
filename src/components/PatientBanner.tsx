import { useEffect, useState } from "react";
import { useApp } from "../store";

/** Hospital-style identification bar: who is using the device, their room, today's date and time. */
export default function PatientBanner() {
  const { t, lang, name, room } = useApp();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 20_000); return () => clearInterval(id); }, []);
  const loc = lang === "th" ? "th-TH" : "en-GB";
  return (
    <div className="banner">
      <div className="banner-id">
        <span className="banner-label">{t("resident")}</span>
        <b>{name}</b>
        <span className="banner-sep" />
        <span className="banner-label">{t("room")}</span>
        <b>{room}</b>
      </div>
      <div className="banner-time">
        <span>{now.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
        <b>{now.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}</b>
      </div>
    </div>
  );
}
