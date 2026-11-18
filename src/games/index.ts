import type { ComponentType } from "react";
import type { Key } from "../i18n";
import type { IconName } from "../components/Icon";
import ColorMatch from "./ColorMatch";
import MathQuiz from "./MathQuiz";
import MemoryCards from "./MemoryCards";
import Pattern from "./Pattern";

export type Level = "easy" | "medium" | "hard";
export interface GameProps { level: Level; onFinish: (score: number, total: number) => void }

export const GAMES: { id: string; ico: IconName; title: Key; Comp: ComponentType<GameProps> }[] = [
  { id: "color", ico: "palette", title: "colorMatch", Comp: ColorMatch },
  { id: "math", ico: "calc", title: "mathQuiz", Comp: MathQuiz },
  { id: "memory", ico: "cards", title: "memory", Comp: MemoryCards },
  { id: "pattern", ico: "trend", title: "pattern", Comp: Pattern },
];

export const ROUNDS = 5;
export const shuffle = <T,>(a: T[]): T[] => [...a].sort(() => Math.random() - 0.5);
export const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
