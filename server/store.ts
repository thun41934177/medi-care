import fs from "node:fs";
import path from "node:path";

export const DATA = path.resolve("server/data");
fs.mkdirSync(DATA, { recursive: true });

export function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8")) as T; } catch { return fallback; }
}

/** Writes to a temp file first, so a crash can never leave a half-written data file. */
export function writeJson(file: string, data: unknown) {
  const p = path.join(DATA, file);
  fs.writeFileSync(p + ".tmp", JSON.stringify(data));
  fs.renameSync(p + ".tmp", p);
}

export function removeFile(file: string) {
  try { fs.unlinkSync(path.join(DATA, file)); } catch { /* already gone */ }
}

/** Local calendar date (YYYY-MM-DD). */
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
