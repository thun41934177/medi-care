import { execFile, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Text-to-speech using the computer's own voices (macOS `say`), all offline.
 * This gives reliable Thai and English speech to any browser or tablet that connects.
 */
interface SayVoice { name: string; locale: string }

const CACHE = path.join(os.tmpdir(), "medicare-tts");
fs.mkdirSync(CACHE, { recursive: true });

let voices: SayVoice[] = [];
const ready = new Promise<void>((resolve) => {
  if (process.platform !== "darwin") return resolve();
  execFile("say", ["-v", "?"], (err, out) => {
    if (!err) {
      voices = out.split("\n").flatMap((l) => {
        const m = l.match(/^(.*?)\s+([a-z]{2}_[A-Z]{2})\s+#/);
        return m ? [{ name: m[1].trim(), locale: m[2] }] : [];
      });
    }
    resolve();
  });
});

const EN_FAVORITES = ["Ava", "Allison", "Samantha", "Susan", "Serena", "Karen", "Moira", "Daniel"];
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|ralph|bruce/i;

export function voiceFor(lang: string): string | null {
  if (lang === "th") return voices.find((v) => v.locale === "th_TH")?.name ?? null;
  const en = voices.filter((v) => v.locale.startsWith("en_") && !NOVELTY.test(v.name));
  for (const fav of EN_FAVORITES) {
    const v = en.find((x) => x.name.startsWith(fav));
    if (v) return v.name;
  }
  return en[0]?.name ?? null;
}

export async function ttsStatus() {
  await ready;
  return { available: voices.length > 0, voices: { th: voiceFor("th"), en: voiceFor("en") } };
}

/** Returns the path of a WAV file with the spoken text (cached). */
export async function synthesize(text: string, lang: string, rate: number): Promise<string> {
  await ready;
  const voice = voiceFor(lang);
  if (!voice) throw new Error("no voice");
  // Thai is read more slowly: the built-in Thai voice sounds hurried and unnatural at normal speed
  const wpm = Math.min(260, Math.max(100, Math.round((lang === "th" ? 150 : 185) * (rate || 0.92))));
  const clean = text.replace(/\[\[[^\]]*\]\]/g, "").slice(0, 600);
  const file = path.join(CACHE, crypto.createHash("sha1").update(`${voice}|${wpm}|${clean}`).digest("hex") + ".wav");
  if (fs.existsSync(file)) return file;

  await new Promise<void>((resolve, reject) => {
    const tmp = file + ".tmp";
    // text goes in through stdin (-f -), so it can never be read as a command-line option
    const p = spawn("say", ["-v", voice, "-r", String(wpm), "-o", tmp, "--file-format=WAVE", "--data-format=LEI16@22050", "-f", "-"], { stdio: ["pipe", "ignore", "ignore"] });
    const timer = setTimeout(() => { p.kill(); reject(new Error("tts timeout")); }, 20_000);
    p.on("error", (e) => { clearTimeout(timer); reject(e); });
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(tmp)) { fs.renameSync(tmp, file); resolve(); }
      else reject(new Error(`say exited with ${code}`));
    });
    p.stdin.end(clean);
  });
  return file;
}
