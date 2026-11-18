import Dexie, { Table } from "dexie";

export interface Med { id?: number; name: string; time: string } // time "HH:MM"
export interface DoseLog { id?: number; medId: number; date: string; status: "taken" | "skipped" }
export interface HealthLog { id?: number; at: number; sys?: number; dia?: number; sugar?: number; mood?: string; sleep?: number }
export interface GameLog { id?: number; at: number; game: string; level: string; score: number; total: number }

class AppDB extends Dexie {
  meds!: Table<Med, number>;
  doses!: Table<DoseLog, number>;
  health!: Table<HealthLog, number>;
  games!: Table<GameLog, number>;
  constructor() {
    super("care-companion");
    this.version(1).stores({
      meds: "++id",
      doses: "++id, medId, date",
      health: "++id, at",
      games: "++id, at, game",
    });
  }
}
export const db = new AppDB();

export const todayStr = () => new Date().toISOString().slice(0, 10);
