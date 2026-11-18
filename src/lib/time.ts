/** "5 minutes ago" in the chosen language. */
export function ago(ts: number, lang: string): string {
  if (!ts) return "";
  const rtf = new Intl.RelativeTimeFormat(lang === "th" ? "th" : "en", { numeric: "auto" });
  const s = Math.round((ts - Date.now()) / 1000);
  const a = Math.abs(s);
  if (a < 60) return rtf.format(Math.round(s / 1) , "second");
  if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}
