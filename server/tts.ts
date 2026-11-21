import { execFile, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Text-to-speech using the server computer's own voices, all offline:
 *  - macOS: the built-in `say` voices (Thai: Kanya)
 *  - Linux (e.g. Raspberry Pi / Ubuntu): `espeak-ng` (install with: sudo apt install espeak-ng)
 * Every browser or tablet that connects can use these voices.
 */
interface SayVoice { name: string; locale: string }

const CACHE = path.join(os.tmpdir(), "medicare-tts");
fs.mkdirSync(CACHE, { recursive: true });

const isMac = process.platform === "darwin";
let voices: SayVoice[] = [];
let espeak = false;

const ready = new Promise<void>((resolve) => {
  if (isMac) {
    execFile("say", ["-v", "?"], (err, out) => {
      if (!err) {
        voices = out.split("\n").flatMap((l) => {
          const m = l.match(/^(.*?)\s+([a-z]{2}_[A-Z]{2})\s+#/);
          return m ? [{ name: m[1].trim(), locale: m[2] }] : [];
        });
      }
      resolve();
    });
  } else {
    execFile("espeak-ng", ["--version"], (err) => { espeak = !err; resolve(); });
  }
});

const EN_FAVORITES = ["Ava", "Allison", "Samantha", "Susan", "Serena", "Karen", "Moira", "Daniel"];
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|ralph|bruce/i;

export function voiceFor(lang: string): string | null {
  if (espeak) return lang === "th" ? "th" : "en-us";
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
  const label = (l: string) => (espeak ? `espeak-ng (${voiceFor(l)})` : voiceFor(l));
  return { available: espeak || voices.length > 0, voices: { th: label("th"), en: label("en") } };
}

/** Returns the path of a WAV file with the spoken text (cached). */
export async function synthesize(text: string, lang: string, rate: number): Promise<string> {
  await ready;
  const voice = voiceFor(lang);
  if (!voice) throw new Error("no voice");
  // Thai is read more slowly: it sounds hurried and unnatural at normal speed
  const wpm = Math.min(260, Math.max(100, Math.round((lang === "th" ? 150 : 185) * (rate || 0.92))));
  const clean = text.replace(/\[\[[^\]]*\]\]/g, "").slice(0, 600);
  const file = path.join(CACHE, crypto.createHash("sha1").update(`${voice}|${wpm}|${clean}`).digest("hex") + ".wav");
  if (fs.existsSync(file)) return file;

  await new Promise<void>((resolve, reject) => {
    const tmp = file + ".tmp";
    // text goes in through stdin, so it can never be read as a command-line option
    const cmd = espeak ? "espeak-ng" : "say";
    const args = espeak
      ? ["-v", voice, "-s", String(wpm), "-w", tmp, "--stdin"]
      : ["-v", voice, "-r", String(wpm), "-o", tmp, "--file-format=WAVE", "--data-format=LEI16@22050", "-f", "-"];
    const p = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] });
    const timer = setTimeout(() => { p.kill(); reject(new Error("tts timeout")); }, 20_000);
    p.on("error", (e) => { clearTimeout(timer); reject(e); });
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(tmp)) { fs.renameSync(tmp, file); resolve(); }
      else reject(new Error(`${cmd} exited with ${code}`));
    });
    p.stdin.end(clean);
  });
  return file;
}
