import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Lang, Key, tr } from "./i18n";

export type Mode = "friend" | "plan" | "";
interface Settings { lang: Lang; name: string; room: string; provider: string; scale: number; mode: Mode; modeDay: string; autoSpeak: boolean }
/** Local calendar date, e.g. 2026-11-18 (used so the mode is asked once per day). */
export const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const DEFAULTS: Settings = { lang: "en", name: "Resident", room: "-", provider: "", scale: 1.2, mode: "", modeDay: "", autoSpeak: true };

interface Ctx extends Settings {
  set: (p: Partial<Settings>) => void;
  t: (k: Key) => string;
}
const C = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(C);

function load(): Settings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("settings") || "{}") }; } catch { return DEFAULTS; }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Settings>(load);
  useEffect(() => {
    try { localStorage.setItem("settings", JSON.stringify(s)); } catch {}
    document.documentElement.style.fontSize = `${16 * s.scale}px`;
    document.documentElement.lang = s.lang;
  }, [s]);
  const value: Ctx = { ...s, set: (p) => setS((o) => ({ ...o, ...p })), t: (k) => tr(s.lang, k) };
  return <C.Provider value={value}>{children}</C.Provider>;
}
