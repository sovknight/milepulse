import { addDays, daysBetween, formatDate, isIsoDate } from './dates';
import type { Reading } from './types';

/** Recent driving is measured over this many days before the latest reading. */
export const RECENT_WINDOW_DAYS = 90;
/** A recent rate needs readings at least this far apart to be trusted. */
export const RECENT_MIN_SPAN_DAYS = 14;

export interface Stats {
  first: Reading;
  last: Reading;
  spanDays: number;
  totalDistance: number;
  /** Average distance per day across all readings, or null with under 1 day of data. */
  overallPerDay: number | null;
  /** Average per day across the recent window, or null without enough recent data. */
  recentPerDay: number | null;
  /** Rate used for projections: recent when available, otherwise overall. */
  perDay: number | null;
}

export interface Milestone {
  odometer: number;
  date: string;
  daysFromLast: number;
}

export function sortReadings(readings: Reading[]): Reading[] {
  return [...readings].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function computeStats(readings: Reading[]): Stats | null {
  const sorted = sortReadings(readings);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return null;

  const spanDays = daysBetween(first.date, last.date);
  const totalDistance = last.odometer - first.odometer;
  const overallPerDay = spanDays > 0 ? totalDistance / spanDays : null;

  let recentPerDay: number | null = null;
  const windowStart = sorted.find((r) => daysBetween(r.date, last.date) <= RECENT_WINDOW_DAYS);
  if (windowStart && windowStart !== last) {
    const span = daysBetween(windowStart.date, last.date);
    if (span >= RECENT_MIN_SPAN_DAYS) {
      recentPerDay = (last.odometer - windowStart.odometer) / span;
    }
  }

  return {
    first,
    last,
    spanDays,
    totalDistance,
    overallPerDay,
    recentPerDay,
    perDay: recentPerDay ?? overallPerDay,
  };
}

/** Upcoming odometer milestones, projected forward from the latest reading. */
export function projectMilestones(stats: Stats, interval: number, count = 8): Milestone[] {
  const rate = stats.perDay;
  if (rate === null || rate <= 0) return [];
  const out: Milestone[] = [];
  let target = (Math.floor(stats.last.odometer / interval) + 1) * interval;
  for (let i = 0; i < count; i++, target += interval) {
    const daysFromLast = Math.ceil((target - stats.last.odometer) / rate);
    out.push({ odometer: target, date: addDays(stats.last.date, daysFromLast), daysFromLast });
  }
  return out;
}

export interface Paces {
  week: number;
  month: number;
  year: number;
}

const DAYS_PER_YEAR = 365.25;

/** Converts a per-day rate into week, month and year equivalents. */
export function paces(perDay: number): Paces {
  return { week: perDay * 7, month: (perDay * DAYS_PER_YEAR) / 12, year: perDay * DAYS_PER_YEAR };
}

/** Estimated odometer on a given date, extrapolated from the latest reading. */
export function estimateOdometer(stats: Stats, dateIso: string): number {
  const days = Math.max(0, daysBetween(stats.last.date, dateIso));
  return stats.last.odometer + (stats.perDay ?? 0) * days;
}

export interface ReadingInput {
  id?: string;
  date: string;
  odometer: number;
  isPurchase?: boolean;
}

/**
 * Checks a new or edited reading against the vehicle's other readings.
 * Returns a user-facing error message, or null when the reading is valid.
 */
export function validateReading(
  existing: Reading[],
  input: ReadingInput,
  today: string,
): string | null {
  if (!isIsoDate(input.date)) return 'Enter a valid date.';
  if (input.date > today) return 'The date cannot be in the future.';
  if (!Number.isFinite(input.odometer) || input.odometer < 0) {
    return 'Enter an odometer reading of 0 or more.';
  }
  for (const r of existing) {
    if (r.id === input.id) continue;
    if (r.date === input.date) {
      return 'There is already a reading for this date. Edit that one instead.';
    }
    if (r.isPurchase && !input.isPurchase && input.date < r.date) {
      return `The date is before the purchase date (${formatDate(r.date)}).`;
    }
    if (input.isPurchase && r.date < input.date) {
      return `The purchase reading must be the earliest one, but there is a reading on ${formatDate(r.date)}.`;
    }
    if (r.date < input.date && r.odometer > input.odometer) {
      return `The odometer cannot be lower than the ${formatDate(r.date)} reading (${r.odometer.toLocaleString()}).`;
    }
    if (r.date > input.date && r.odometer < input.odometer) {
      return `The odometer cannot be higher than the ${formatDate(r.date)} reading (${r.odometer.toLocaleString()}).`;
    }
  }
  return null;
}
