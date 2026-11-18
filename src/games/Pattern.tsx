import { useMemo, useState } from "react";
import { useApp } from "../store";
import { speak } from "../lib/speech";
import { GameProps, ROUNDS, rand, shuffle } from "./index";

const SHAPES = ["▲", "■", "●", "◆"];

function make(level: GameProps["level"]) {
  if (Math.random() < 0.5) {
    // number sequence with constant step
    const step = rand(2, level === "easy" ? 3 : level === "medium" ? 6 : 9);
    const start = rand(1, 20);
    const seq = Array.from({ length: 5 }, (_, i) => start + step * i);
    const answer = seq[4];
    const wrong = new Set<number>();
    while (wrong.size < 3) { const w = answer + rand(-6, 6); if (w !== answer) wrong.add(w); }
    return { shown: seq.slice(0, 4).map(String), answer: String(answer), choices: shuffle([String(answer), ...[...wrong].map(String)]) };
  }
  // repeating shape pattern A B A B ?
  const [a, b, c] = shuffle(SHAPES);
  const unit = level === "easy" ? [a, b] : [a, b, c];
  const seq = Array.from({ length: unit.length * 2 + 1 }, (_, i) => unit[i % unit.length]);
  const answer = seq.pop()!;
  return { shown: seq, answer, choices: shuffle(SHAPES.slice(0, 4)) };
}

export default function Pattern({ level, onFinish }: GameProps) {
  const { t, lang } = useApp();
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [ok, setOk] = useState(false);
  const q = useMemo(() => make(level), [round, level]);

  function pick(c: string) {
    if (c === q.answer) {
      setOk(true);
      const s = score + (wrong === 0 ? 1 : 0);
      setScore(s);
      speak(t("correct"), lang);
      setTimeout(() => {
        setOk(false); setWrong(0);
        if (round + 1 >= ROUNDS) onFinish(s, ROUNDS); else setRound(round + 1);
      }, 900);
    } else setWrong(wrong + 1);
  }

  return (
    <div>
      <div className="progress"><i style={{ width: `${(round / ROUNDS) * 100}%` }} /></div>
      <div className="big">{q.shown.join("  ")}  ?</div>
      <div className="choices">
        {q.choices.map((c) => <button key={c} onClick={() => pick(c)}>{c}</button>)}
      </div>
      {ok && <p className="msg-ok">{t("correct")}</p>}
      {!ok && wrong > 0 && <p className="msg-bad">{t("tryAgain")}</p>}
    </div>
  );
}
