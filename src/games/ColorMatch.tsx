import { useMemo, useState } from "react";
import { COLORS } from "../i18n";
import { useApp } from "../store";
import { speak } from "../lib/speech";
import { GameProps, ROUNDS, shuffle } from "./index";

export default function ColorMatch({ level, onFinish }: GameProps) {
  const { t, lang } = useApp();
  const count = level === "easy" ? 3 : level === "medium" ? 5 : 8;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<"ok" | "bad" | null>(null);
  const [firstTry, setFirstTry] = useState(true);

  const q = useMemo(() => {
    const opts = shuffle(COLORS).slice(0, count);
    return { opts, target: opts[Math.floor(Math.random() * opts.length)] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, count]);

  function pick(id: string) {
    if (id === q.target.id) {
      setResult("ok");
      const s = score + (firstTry ? 1 : 0);
      setScore(s);
      speak(t("correct"), lang);
      setTimeout(() => {
        setResult(null);
        setFirstTry(true);
        if (round + 1 >= ROUNDS) onFinish(s, ROUNDS);
        else setRound(round + 1);
      }, 900);
    } else {
      setResult("bad");
      setFirstTry(false);
    }
  }

  // Level hard: show the color NAME written in a different ink color (Stroop style), tap by name
  const nameColor = level === "hard" ? COLORS.find((c) => c.id !== q.target.id)!.hex : undefined;

  return (
    <div>
      <div className="progress"><i style={{ width: `${(round / ROUNDS) * 100}%` }} /></div>
      <p style={{ textAlign: "center" }}>{t("tapColor")}</p>
      <div className="big" style={nameColor ? { color: nameColor } : undefined}>
        {q.target[lang]} {level === "easy" && <span style={{ color: q.target.hex }}>●</span>}
      </div>
      <div className="choices">
        {q.opts.map((c) => (
          <button key={c.id} className="swatch" style={{ background: c.hex }} onClick={() => pick(c.id)}>
            {level === "easy" ? "" : level === "medium" ? "" : ""}
          </button>
        ))}
      </div>
      {result === "ok" && <p className="msg-ok">{t("correct")}</p>}
      {result === "bad" && <p className="msg-bad">{t("tryAgain")}</p>}
    </div>
  );
}
