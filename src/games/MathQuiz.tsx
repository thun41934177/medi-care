import { useMemo, useState } from "react";
import { useApp } from "../store";
import { speak } from "../lib/speech";
import { GameProps, ROUNDS, rand, shuffle } from "./index";

type Op = "+" | "-" | "×";

function makeQuestion(level: GameProps["level"], op: Op) {
  const max = level === "easy" ? 20 : level === "medium" ? 60 : 99;
  let a = rand(2, max), b = rand(2, max);
  if (op === "-" && b > a) [a, b] = [b, a];
  if (op === "×") { a = rand(2, level === "easy" ? 5 : 10); b = rand(2, level === "hard" ? 12 : 9); }
  const answer = op === "+" ? a + b : op === "-" ? a - b : a * b;
  const wrong = new Set<number>();
  while (wrong.size < 3) {
    const w = answer + rand(-10, 10);
    if (w !== answer && w >= 0) wrong.add(w);
  }
  return { a, b, answer, choices: shuffle([answer, ...wrong]) };
}

export default function MathQuiz({ level, onFinish }: GameProps) {
  const { t, lang } = useApp();
  const [op, setOp] = useState<Op | null>(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [wrongTries, setWrongTries] = useState(0);
  const [ok, setOk] = useState(false);

  const q = useMemo(() => (op ? makeQuestion(level, op) : null), [op, round, level]);

  if (!op || !q) {
    return (
      <div className="choices">
        {([["+", t("plus")], ["-", t("minus")], ["×", t("times")]] as [Op, string][]).map(([o, label]) => (
          <button key={o} onClick={() => setOp(o)}>{o} {label}</button>
        ))}
      </div>
    );
  }

  const text = `${q.a} ${op} ${q.b}`;

  function pick(n: number) {
    if (n === q!.answer) {
      setOk(true);
      const s = score + (wrongTries === 0 ? 1 : 0);
      setScore(s);
      speak(t("correct"), lang);
      setTimeout(() => {
        setOk(false);
        setWrongTries(0);
        if (round + 1 >= ROUNDS) onFinish(s, ROUNDS);
        else setRound(round + 1);
      }, 900);
    } else setWrongTries(wrongTries + 1);
  }

  return (
    <div>
      <div className="progress"><i style={{ width: `${(round / ROUNDS) * 100}%` }} /></div>
      <div className="big" style={{ fontSize: "3.4rem" }} onClick={() => speak(text.replace("×", lang === "th" ? "คูณ" : "times").replace("-", lang === "th" ? "ลบ" : "minus").replace("+", lang === "th" ? "บวก" : "plus"), lang)}>
        {text} = ?
      </div>
      <div className="choices">
        {q.choices.map((c) => <button key={c} onClick={() => pick(c)}>{c}</button>)}
      </div>
      {ok && <p className="msg-ok">{t("correct")}</p>}
      {!ok && wrongTries > 0 && <p className="msg-bad">{t("tryAgain")}</p>}
      {!ok && wrongTries >= 2 && <p className="msg-bad">{t("hint")}: {t("answerIs")} {q.answer}</p>}
    </div>
  );
}
