import { useEffect, useState } from "react";
import { useApp } from "../store";
import { speak } from "../lib/speech";
import { GameProps, shuffle } from "./index";

const ICONS = ["★", "♥", "♦", "♣", "♠", "●", "■", "▲"];

export default function MemoryCards({ level, onFinish }: GameProps) {
  const { t, lang } = useApp();
  const pairs = level === "easy" ? 3 : level === "medium" ? 6 : 8;
  const [cards] = useState(() => shuffle([...ICONS.slice(0, pairs), ...ICONS.slice(0, pairs)]));
  const [open, setOpen] = useState<number[]>([]);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    if (done.size === cards.length) {
      speak(t("pairsDone"), lang);
      // score: perfect play = pairs moves; scaled to 5 stars
      const stars = Math.max(1, Math.min(5, Math.round(5 - (moves - pairs) / pairs * 2)));
      setTimeout(() => onFinish(stars, 5), 1200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function flip(i: number) {
    if (open.length === 2 || open.includes(i) || done.has(i)) return;
    const next = [...open, i];
    setOpen(next);
    if (next.length === 2) {
      setMoves(moves + 1);
      if (cards[next[0]] === cards[next[1]]) {
        setTimeout(() => { setDone(new Set([...done, ...next])); setOpen([]); }, 500);
      } else setTimeout(() => setOpen([]), 1000);
    }
  }

  return (
    <div>
      <p>{moves}</p>
      <div className="cardgrid" style={pairs === 3 ? { gridTemplateColumns: "repeat(3,1fr)" } : undefined}>
        {cards.map((c, i) => {
          const shown = open.includes(i) || done.has(i);
          return (
            <button key={i} className={done.has(i) ? "done" : shown ? "open" : ""} onClick={() => flip(i)}>
              {shown ? c : "?"}
            </button>
          );
        })}
      </div>
      {done.size === cards.length && <p className="msg-ok">{t("pairsDone")}</p>}
    </div>
  );
}
