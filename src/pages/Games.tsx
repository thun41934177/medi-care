import { useState } from "react";
import { db } from "../db";
import { syncGame } from "../lib/sync";
import { useApp } from "../store";
import { speak } from "../lib/speech";
import { GAMES, Level } from "../games";
import PageHeader from "../components/PageHeader";
import Icon from "../components/Icon";

const TONES = ["blue", "purple", "green", "orange"];

export default function Games() {
  const { t, lang } = useApp();
  const [gameId, setGameId] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>("easy");
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [run, setRun] = useState(0);

  const game = GAMES.find((g) => g.id === gameId);

  async function finish(score: number, total: number) {
    setResult({ score, total });
    speak(`${t("correct")} ${t("score")} ${score}/${total}`, lang);
    const entry = { at: Date.now(), game: game!.id, level, score, total };
    await db.games.add(entry);
    syncGame(entry);
    fetch("/api/robot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "face", emotion: "happy" }) }).catch(() => {});
  }

  if (game && result) {
    return (
      <div className="page" style={{ textAlign: "center" }}>
        <PageHeader icon="game" title={t(game.title)} color="var(--g-orange)" />
        <div className="card" style={{ padding: "2rem 1rem" }}>
          <div className="stars">{Array.from({ length: 5 }, (_, i) => <span key={i} className={i < Math.max(1, Math.round((result.score / result.total) * 5)) ? "on" : ""}><Icon name="star" size={46} fill /></span>)}</div>
          <p className="big" style={{ margin: ".4rem 0" }}>{t("correct")}</p>
          <p className="muted" style={{ fontSize: "1.3rem" }}>{t("score")}: <b>{result.score}/{result.total}</b></p>
          <div className="row" style={{ justifyContent: "center", marginTop: "1.2rem" }}>
            <button className="primary" onClick={() => { setResult(null); setRun(run + 1); }}>{t("playAgain")}</button>
            <button onClick={() => { setResult(null); setGameId(null); }}>{t("games")}</button>
          </div>
        </div>
      </div>
    );
  }

  if (game) {
    return (
      <div className="page">
        <PageHeader icon="game" title={t(game.title)} color="var(--g-orange)" sub={t(level)} />
        <div className="card"><game.Comp key={run} level={level} onFinish={finish} /></div>
        <button className="ghost" onClick={() => setGameId(null)}><Icon name="back" size={20} /> {t("games")}</button>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader icon="game" title={t("games")} color="var(--g-orange)" />
      <div className="seg" style={{ marginBottom: "1.1rem" }}>
        {(["easy", "medium", "hard"] as Level[]).map((l) => (
          <button key={l} className={level === l ? "primary" : ""} onClick={() => setLevel(l)}>{t(l)}</button>
        ))}
      </div>
      <div className="grid2">
        {GAMES.map((g, i) => (
          <button key={g.id} className="tile" data-tone={TONES[i % TONES.length]} onClick={() => { setRun(run + 1); setGameId(g.id); }}>
            <span className="ico"><Icon name={g.ico} size={32} /></span>{t(g.title)}
          </button>
        ))}
      </div>
    </div>
  );
}
