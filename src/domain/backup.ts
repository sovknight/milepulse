import { daysBetween, isIsoDate } from './dates';
import type { Reading, Vehicle } from './types';

export const BACKUP_VERSION = 1;

export interface Backup {
  app: 'milepulse';
  version: number;
  exportedAt: string;
  vehicles: Vehicle[];
  readings: Reading[];
}

export function makeBackup(vehicles: Vehicle[], readings: Reading[], now = new Date()): Backup {
  return { app: 'milepulse', version: BACKUP_VERSION, exportedAt: now.toISOString(), vehicles, readings };
}

/** Parses and validates a backup file. Throws an Error with a user-facing message. */
export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const b = data as Partial<Backup>;
  if (!b || b.app !== 'milepulse' || !Array.isArray(b.vehicles) || !Array.isArray(b.readings)) {
    throw new Error('That file is not an MilePulse backup.');
  }
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new Error('That backup was made by a newer version of MilePulse.');
  }
  const ids = new Set<string>();
  for (const v of b.vehicles) {
    if (typeof v?.id !== 'string' || typeof v.name !== 'string' || (v.unit !== 'mi' && v.unit !== 'km')) {
      throw new Error('The backup contains a damaged vehicle entry.');
    }
    ids.add(v.id);
  }
  for (const r of b.readings) {
    if (
      typeof r?.id !== 'string' ||
      !ids.has(r.vehicleId) ||
      typeof r.date !== 'string' ||
      !isIsoDate(r.date) ||
      typeof r.odometer !== 'number' ||
      !Number.isFinite(r.odometer)
    ) {
      throw new Error('The backup contains a damaged reading entry.');
    }
  }
  return b as Backup;
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function readingsCsv(vehicle: Vehicle, readings: Reading[]): string {
  return toCsv([
    ['Vehicle', 'Date', `Odometer (${vehicle.unit})`, 'Note'],
    ...readings.map((r) => [vehicle.name, r.date, r.odometer, r.note ?? '']),
  ]);
}

/** Days after the last backup before the list screen starts suggesting another. */
export const BACKUP_NUDGE_DAYS = 30;
/** With no backup yet, how long after first use before suggesting one. */
export const BACKUP_GRACE_DAYS = 7;

/** Whether to show a backup suggestion. `firstUse` is the local date the oldest vehicle was added. */
export function backupDue(lastBackup: string | null, firstUse: string | null, today: string): boolean {
  if (!firstUse) return false; // nothing worth backing up yet
  if (lastBackup) return daysBetween(lastBackup, today) > BACKUP_NUDGE_DAYS;
  return daysBetween(firstUse, today) > BACKUP_GRACE_DAYS;
}

export function describeBackupAge(lastBackup: string | null, today: string): string {
  if (!lastBackup) return 'Never';
  const days = Math.max(0, daysBetween(lastBackup, today));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}
