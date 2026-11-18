import { useNavigate } from "react-router-dom";
import { useApp } from "../store";
import { speak } from "../lib/speech";
import Icon from "../components/Icon";
import Logo from "../components/Logo";

/** Start screen, built from design picture 1 (public/hero.jpg is the photo cut from it). */
export default function Start() {
  const { t, lang, set } = useApp();
  const nav = useNavigate();
  return (
    <div className="splash">
      <div className="splash-photo">
        <img src="/hero.jpg" alt="" />
        {/* covers the language pill that is baked into the photo */}
        <div className="langpill">
          <Icon name="globe" size={34} stroke={1.6} />
          <button className={lang === "en" ? "on" : ""} onClick={() => set({ lang: "en" })}>EN</button>
          <i />
          <button className={lang === "th" ? "on" : ""} onClick={() => set({ lang: "th" })}>ภาษาไทย</button>
        </div>
      </div>

      <div className="splash-body">
        <Logo size={64} />
        <h1 className="brand">{t("appName")}</h1>
        <p className="lead">{t("startDesc")}</p>
        <button className="cta" onClick={() => { speak(t("welcome"), lang); nav("/home"); }}>
          {t("getStarted")} <Icon name="arrow" size={32} stroke={2.6} />
        </button>
      </div>
    </div>
  );
}
