import { describe, expect, it } from 'vitest';
import { backupDue, describeBackupAge, makeBackup, parseBackup, toCsv } from './backup';
import { addDays, daysBetween, isIsoDate, todayIso } from './dates';
import { computeStats, estimateOdometer, paces, projectMilestones, validateReading } from './projection';
import type { Reading, Vehicle } from './types';

const r = (date: string, odometer: number, id = date): Reading => ({
  id,
  vehicleId: 'v1',
  date,
  odometer,
});

describe('dates', () => {
  it('counts days across DST changes and leap days', () => {
    expect(daysBetween('2026-03-01', '2026-03-31')).toBe(30); // spans US DST start
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2); // leap year
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('validates ISO dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2/3/2026')).toBe(false);
  });
  it('uses the local calendar day for today', () => {
    expect(todayIso(new Date(2026, 10, 14, 23, 59))).toBe('2026-11-14');
  });
});

describe('computeStats', () => {
  it('returns null with no readings', () => {
    expect(computeStats([])).toBeNull();
  });
  it('has no rate with a single reading', () => {
    const s = computeStats([r('2026-01-01', 1000)])!;
    expect(s.perDay).toBeNull();
    expect(projectMilestones(s, 5000)).toEqual([]);
  });
  it('computes the overall rate regardless of input order', () => {
    const s = computeStats([r('2026-01-11', 1300), r('2026-01-01', 1000)])!;
    expect(s.spanDays).toBe(10);
    expect(s.totalDistance).toBe(300);
    expect(s.overallPerDay).toBe(30);
    expect(s.recentPerDay).toBeNull(); // only 10 days of data
    expect(s.perDay).toBe(30);
  });
  it('prefers the recent rate when driving habits change', () => {
    const s = computeStats([
      r('2025-01-01', 0),
      r('2026-01-01', 3650), // 10/day for a year
      r('2026-01-31', 4250), // then 20/day
    ])!;
    expect(s.recentPerDay).toBe(20);
    expect(s.perDay).toBe(20);
    expect(s.overallPerDay).toBeCloseTo(4250 / 395);
  });
});

describe('projectMilestones', () => {
  it('projects from the latest reading', () => {
    const s = computeStats([r('2026-01-01', 4000), r('2026-01-11', 4500)])!; // 50/day
    const m = projectMilestones(s, 5000, 2);
    expect(m).toEqual([
      { odometer: 5000, date: '2026-01-21', daysFromLast: 10 },
      { odometer: 10000, date: '2026-05-01', daysFromLast: 110 },
    ]);
  });
  it('skips a milestone the odometer is sitting exactly on', () => {
    const s = computeStats([r('2026-01-01', 4000), r('2026-01-11', 5000)])!;
    expect(projectMilestones(s, 5000, 1)[0]!.odometer).toBe(10000);
  });
  it('projects nothing for a parked vehicle', () => {
    const s = computeStats([r('2026-01-01', 4000), r('2026-02-01', 4000)])!;
    expect(projectMilestones(s, 5000)).toEqual([]);
  });
  it('estimates the odometer on a later date', () => {
    const s = computeStats([r('2026-01-01', 4000), r('2026-01-11', 4500)])!;
    expect(estimateOdometer(s, '2026-01-13')).toBe(4600);
    expect(estimateOdometer(s, '2026-01-05')).toBe(4500); // never before the last reading
  });
});

describe('paces', () => {
  it('converts a daily rate to week, month and year', () => {
    expect(paces(10)).toEqual({ week: 70, month: (10 * 365.25) / 12, year: 3652.5 });
  });
});

describe('validateReading', () => {
  const existing = [r('2026-01-01', 1000), r('2026-02-01', 2000)];
  const today = '2026-03-01';
  it('accepts a consistent reading', () => {
    expect(validateReading(existing, { date: '2026-01-15', odometer: 1500 }, today)).toBeNull();
  });
  it('rejects future dates, duplicates and bad numbers', () => {
    expect(validateReading(existing, { date: '2026-03-02', odometer: 3000 }, today)).toMatch(/future/);
    expect(validateReading(existing, { date: '2026-02-01', odometer: 2000 }, today)).toMatch(/already/);
    expect(validateReading(existing, { date: '2026-02-10', odometer: NaN }, today)).toMatch(/odometer/);
  });
  it('rejects readings that run the odometer backwards', () => {
    expect(validateReading(existing, { date: '2026-02-10', odometer: 1900 }, today)).toMatch(/lower/);
    expect(validateReading(existing, { date: '2026-01-15', odometer: 2500 }, today)).toMatch(/higher/);
  });
  it('keeps the purchase reading earliest', () => {
    const withPurchase = [{ ...r('2026-01-01', 1000), isPurchase: true as const }, r('2026-02-01', 2000)];
    expect(validateReading(withPurchase, { date: '2025-12-01', odometer: 900 }, today)).toMatch(/before the purchase/);
    expect(
      validateReading(existing, { date: '2026-01-15', odometer: 1500, isPurchase: true }, today),
    ).toMatch(/earliest/);
    expect(
      validateReading(existing, { date: '2025-12-01', odometer: 900, isPurchase: true }, today),
    ).toBeNull();
  });
  it('lets a reading be edited in place', () => {
    expect(
      validateReading(existing, { id: '2026-02-01', date: '2026-02-01', odometer: 2100 }, today),
    ).toBeNull();
  });
});

describe('backup and csv', () => {
  const vehicle: Vehicle = { id: 'v1', name: 'Truck', unit: 'mi', createdAt: '2026-01-01T00:00:00Z' };
  it('round-trips a backup', () => {
    const backup = makeBackup([vehicle], [r('2026-01-01', 1000)]);
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
  });
  it('rejects foreign or damaged files', () => {
    expect(() => parseBackup('nope')).toThrow(/JSON/);
    expect(() => parseBackup('{"a":1}')).toThrow(/not an MilePulse/);
    const orphan = makeBackup([vehicle], [{ ...r('2026-01-01', 1), vehicleId: 'gone' }]);
    expect(() => parseBackup(JSON.stringify(orphan))).toThrow(/damaged reading/);
  });
  it('quotes commas, quotes and newlines', () => {
    expect(toCsv([['a,b', 'say "hi"', 'x\ny', 5]])).toBe('"a,b","say ""hi""","x\ny",5\r\n');
  });
});

describe('backup nudge', () => {
  it('stays quiet when there is no data', () => {
    expect(backupDue(null, null, '2026-11-14')).toBe(false);
  });
  it('gives new users a week before suggesting a first backup', () => {
    expect(backupDue(null, '2026-11-10', '2026-11-14')).toBe(false);
    expect(backupDue(null, '2026-11-01', '2026-11-14')).toBe(true);
  });
  it('suggests another backup after 30 days', () => {
    expect(backupDue('2026-10-15', '2026-01-01', '2026-11-14')).toBe(false); // 30 days
    expect(backupDue('2026-10-14', '2026-01-01', '2026-11-14')).toBe(true); // 31 days
  });
  it('describes the age of the last backup', () => {
    expect(describeBackupAge(null, '2026-11-14')).toBe('Never');
    expect(describeBackupAge('2026-11-14', '2026-11-14')).toBe('Today');
    expect(describeBackupAge('2026-11-13', '2026-11-14')).toBe('Yesterday');
    expect(describeBackupAge('2026-11-02', '2026-11-14')).toBe('12 days ago');
    expect(describeBackupAge('2026-11-20', '2026-11-14')).toBe('Today'); // clock moved back
  });
});
