import { useCallback, useEffect, useState } from 'preact/hooks';
import { getVehicle, listReadings } from '../db';
import { readingsCsv } from '../domain/backup';
import { daysBetween, formatDate, todayIso } from '../domain/dates';
import { computeStats, estimateOdometer, paces, projectMilestones, sortReadings } from '../domain/projection';
import { MILESTONE_INTERVAL, type Reading, type Vehicle } from '../domain/types';
import { ReadingForm, VehicleForm } from './Forms';
import { downloadFile, fmt, safeFileName } from './util';

type Dialog = { kind: 'none' } | { kind: 'vehicle' } | { kind: 'reading'; reading?: Reading };

export function VehicleDetail({ vehicleId }: { vehicleId: string }) {
  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });

  const load = useCallback(async () => {
    const [v, r] = await Promise.all([getVehicle(vehicleId), listReadings(vehicleId)]);
    setVehicle(v ?? null);
    setReadings(sortReadings(r));
  }, [vehicleId]);

  useEffect(() => void load(), [load]);

  if (vehicle === undefined) return null;
  if (vehicle === null) {
    return (
      <section class="empty">
        <h2>Vehicle not found</h2>
        <a class="btn primary" href="#vehicles">
          Back to vehicles
        </a>
      </section>
    );
  }

  const today = todayIso();
  const stats = computeStats(readings);
  const milestones = stats ? projectMilestones(stats, MILESTONE_INTERVAL[vehicle.unit]) : [];
  const unit = vehicle.unit;
  const close = () => setDialog({ kind: 'none' });
  const purchase = readings.find((r) => r.isPurchase);

  return (
    <>
      <header class="page-head">
        <a class="back" href="#vehicles" aria-label="Back to vehicles">
          ‹
        </a>
        <h1>{vehicle.name}</h1>
        <button type="button" class="btn ghost" onClick={() => setDialog({ kind: 'vehicle' })}>
          Edit
        </button>
      </header>

      <section class="hero">
        {stats ? (
          <>
            <p class="label">Odometer on {formatDate(stats.last.date)}</p>
            <p class="odo big">
              {fmt(stats.last.odometer)} <small>{unit}</small>
            </p>
            {stats.perDay !== null && stats.perDay > 0 && daysBetween(stats.last.date, today) > 0 && (
              <p class="hint">About {fmt(estimateOdometer(stats, today))} {unit} today, at your current pace.</p>
            )}
          </>
        ) : (
          <p class="hint">No readings yet. Add the current odometer to get started.</p>
        )}
        <button type="button" class="btn primary" onClick={() => setDialog({ kind: 'reading' })}>
          Add reading
        </button>
      </section>

      {stats && stats.perDay !== null && (
        <section>
          <h2>Pace</h2>
          <ul class="list">
            {(
              [
                ['Per week', paces(stats.perDay).week],
                ['Per month', paces(stats.perDay).month],
                ['Per year', paces(stats.perDay).year],
              ] as const
            ).map(([label, value]) => (
              <li key={label}>
                <span>{label}</span>
                <span class="odo">
                  {fmt(value)} <small>{unit}</small>
                </span>
              </li>
            ))}
          </ul>
          <p class="hint center">
            {stats.recentPerDay !== null
              ? 'Based on your last 90 days of readings.'
              : `Based on all ${fmt(stats.spanDays)} days of readings.`}{' '}
            {fmt(stats.totalDistance)} {unit} {purchase ? 'since purchase' : 'tracked'}.
          </p>
        </section>
      )}
      {purchase && (
        <p class="hint center">
          Bought {formatDate(purchase.date)} at {fmt(purchase.odometer)} {unit}, {fmt(daysBetween(purchase.date, today))} days ago.
        </p>
      )}

      {stats && (
        <section>
          <h2>Upcoming milestones</h2>
          {milestones.length > 0 ? (
            <ul class="list">
              {milestones.map((m) => (
                <li key={m.odometer}>
                  <span class="odo">
                    {fmt(m.odometer)} <small>{unit}</small>
                  </span>
                  <span class="when">
                    {formatDate(m.date)}
                    <small>{m.date <= today ? 'due now' : `in ${fmt(daysBetween(today, m.date))} days`}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="hint">
              {readings.length < 2
                ? 'Add a second reading on a later date to see projections.'
                : 'No distance driven between readings, so there is nothing to project yet.'}
            </p>
          )}
        </section>
      )}

      {readings.length > 0 && (
        <section>
          <div class="section-head">
            <h2>Readings</h2>
            <button
              type="button"
              class="btn ghost"
              onClick={() =>
                downloadFile(`${safeFileName(vehicle.name)}_readings.csv`, 'text/csv', readingsCsv(vehicle, readings))
              }
            >
              Export CSV
            </button>
          </div>
          <ul class="list">
            {[...readings].reverse().map((r) => (
              <li key={r.id}>
                <button type="button" class="row-btn" onClick={() => setDialog({ kind: 'reading', reading: r })}>
                  <span class="odo">
                    {fmt(r.odometer, 1)} <small>{unit}</small>
                  </span>
                  <span class="when">
                    {formatDate(r.date)}
                    {(r.isPurchase || r.note) && (
                      <small>{[r.isPurchase ? 'Purchase' : '', r.note ?? ''].filter(Boolean).join(' · ')}</small>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dialog.kind === 'vehicle' && (
        <VehicleForm
          vehicle={vehicle}
          onClose={close}
          onDone={(_, deleted) => {
            if (deleted) location.hash = '#vehicles';
            else {
              close();
              void load();
            }
          }}
        />
      )}
      {dialog.kind === 'reading' && (
        <ReadingForm
          vehicle={vehicle}
          readings={readings}
          reading={dialog.reading}
          onClose={close}
          onDone={() => {
            close();
            void load();
          }}
        />
      )}
    </>
  );
}
