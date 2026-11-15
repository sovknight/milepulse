export type Unit = 'mi' | 'km';

export interface Vehicle {
  id: string;
  name: string;
  /** Unit the odometer reads in. Readings are stored exactly as entered, in this unit. */
  unit: Unit;
  createdAt: string;
}

export interface Reading {
  id: string;
  vehicleId: string;
  /** Local calendar date, YYYY-MM-DD. Never a timestamp, so no timezone drift. */
  date: string;
  odometer: number;
  note?: string;
  /** Marks the reading taken when the vehicle was bought. At most one per vehicle, always the earliest. */
  isPurchase?: true;
}

export const UNIT_LABEL: Record<Unit, string> = { mi: 'miles', km: 'kilometers' };

/** Milestone spacing per unit. */
export const MILESTONE_INTERVAL: Record<Unit, number> = { mi: 5000, km: 10000 };

export function newId(): string {
  return crypto.randomUUID();
}
