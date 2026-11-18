import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../store";
import PageHeader from "../components/PageHeader";
import Icon from "../components/Icon";
import { voicesFor, getVoicePref, setVoicePref, getRate, setRate, speak, onVoicesChanged, pickVoice, getEngine, setEngine, getServerVoices } from "../lib/speech";

export default function Settings() {
  const { t, lang, name, room, provider, scale, autoSpeak, set } = useApp();
  const [providers, setProviders] = useState<{ id: string; label: string }[]>([]);
  const [def, setDef] = useState("");
  const [robot, setRobot] = useState<{ adapter: string; connected: boolean } | null>(null);
  const [, bump] = useState(0);
  const [rate, setRateState] = useState(getRate());

  useEffect(() => {
    fetch("/api/providers").then((r) => r.json()).then((d) => { setProviders(d.providers); setDef(d.default); }).catch(() => {});
    fetch("/api/robot").then((r) => r.json()).then(setRobot).catch(() => {});
    return onVoicesChanged(() => bump((n) => n + 1));
  }, []);

  const voices = voicesFor(lang);
  const current = getVoicePref(lang);

  return (
    <div className="page">
      <PageHeader icon="gear" title={t("settings")} color="var(--navy)" />
      <div className="cols">
        <div>
          <div className="card">
            <label style={{ marginTop: 0 }}>{t("name")}</label>
            <input value={name} onChange={(e) => set({ name: e.target.value })} />
            <label>{t("room")}</label>
            <input value={room} onChange={(e) => set({ room: e.target.value })} />
            <label>{t("language")}</label>
            <div className="seg">
              <button className={lang === "en" ? "primary" : ""} onClick={() => set({ lang: "en" })}>English</button>
              <button className={lang === "th" ? "primary" : ""} onClick={() => set({ lang: "th" })}>ไทย</button>
            </div>
            <label>{t("textSize")}</label>
            <input type="range" min="1" max="1.8" step="0.1" value={scale} onChange={(e) => set({ scale: Number(e.target.value) })} />
          </div>
        </div>

        <div>
          <div className="card">
            <h2><Icon name="volume" size={22} /> {t("voiceSettings")}</h2>
            <label style={{ marginTop: 0 }}>{t("voiceEngine")}</label>
            <select value={getEngine()} onChange={(e) => { setEngine(e.target.value as "auto" | "server" | "browser"); bump((n) => n + 1); }}>
              <option value="auto">{t("engineAuto")}</option>
              <option value="server">{t("engineServer")}</option>
              <option value="browser">{t("engineBrowser")}</option>
            </select>
            {getServerVoices()?.available && (
              <p className="muted" style={{ margin: ".4rem 0 0" }}>{t("computerVoice")}: {getServerVoices()!.voices[lang] ?? "—"}</p>
            )}
            {voices.length === 0 && !getServerVoices()?.voices[lang] ? (
              <p className="msg-bad" style={{ textAlign: "left" }}>{t("voiceNone")}</p>
            ) : (
              <>
                <select
                  value={current}
                  onChange={(e) => { setVoicePref(lang, e.target.value); bump((n) => n + 1); }}
                >
                  <option value="">{t("voiceAuto")}{pickVoice(lang) ? ` — ${pickVoice(lang)!.name}` : ""}</option>
                  {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                </select>
                <label>{t("voiceSpeed")}</label>
                <input
                  type="range" min="0.6" max="1.3" step="0.05" value={rate}
                  onChange={(e) => { const r = Number(e.target.value); setRate(r); setRateState(r); }}
                />
              </>
            )}
            <label className="check">
              <input type="checkbox" checked={autoSpeak} onChange={(e) => set({ autoSpeak: e.target.checked })} />
              <span>{t("readAloud")}</span>
            </label>
            <div style={{ marginTop: ".8rem" }}>
              <button className="primary" onClick={() => speak(t("voiceSample"), lang)}><Icon name="volume" size={22} /> {t("voiceTest")}</button>
            </div>
          </div>

          <div className="card">
            <label style={{ marginTop: 0 }}>{t("chooseAi")}</label>
            <select value={provider || def} onChange={(e) => set({ provider: e.target.value })}>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <label>{t("robotStatus")}</label>
            <div className="row">
              <span className={`dot ${robot?.connected ? "ok" : "bad"}`} />
              {robot ? `${t("robot")}: ${robot.adapter}` : "—"}
            </div>
          </div>
        </div>
      </div>
      <Link to="/staff"><button><Icon name="users" size={22} /> {t("staff")}</button></Link>
    </div>
  );
}
