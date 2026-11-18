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
  constructor(name: string) {
    super(name);
    this.version(1).stores({
      meds: "++id",
      doses: "++id, medId, date",
      health: "++id, at",
      games: "++id, at, game",
    });
  }
}

/** Every signed-in person gets their own local database, so people sharing a tablet never see each other's data. */
export let db = new AppDB("care-companion-guest");
export function openUserDb(userId: string) {
  const name = `care-companion-${userId}`;
  if (db.name === name) return;
  db.close();
  db = new AppDB(name);
}

/** Local calendar date (not UTC), so "today" changes at local midnight. */
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
