import { useCallback, useEffect, useState } from 'preact/hooks';
import { listAllReadings, listVehicles } from '../db';
import { backupDue, describeBackupAge } from '../domain/backup';
import { formatDate, todayIso } from '../domain/dates';
import { computeStats, projectMilestones } from '../domain/projection';
import { MILESTONE_INTERVAL, type Reading, type Vehicle } from '../domain/types';
import { getLastBackup } from '../settings';
import { ReadingForm, VehicleForm } from './Forms';
import { fmt } from './util';

export function VehicleList() {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [adding, setAdding] = useState(false);
  const [quickAdd, setQuickAdd] = useState<Vehicle | null>(null);

  const load = useCallback(async () => {
    const [v, r] = await Promise.all([listVehicles(), listAllReadings()]);
    setVehicles(v);
    setReadings(r);
  }, []);

  useEffect(() => void load(), [load]);

  if (!vehicles) return null;

  const today = todayIso();
  const lastBackup = getLastBackup();
  const oldest = vehicles[0];
  const firstUse = oldest ? todayIso(new Date(oldest.createdAt)) : null;
  const showBackupNudge = backupDue(lastBackup, firstUse, today);

  return (
    <>
      <header class="page-head">
        <h1>Vehicles</h1>
        {vehicles.length > 0 && (
          <button type="button" class="btn primary small" onClick={() => setAdding(true)}>
            Add
          </button>
        )}
      </header>

      {showBackupNudge && (
        <p class="notice">
          {lastBackup
            ? `Your last backup was ${describeBackupAge(lastBackup, today).toLowerCase()}. `
            : 'Your data is stored only on this phone and has not been backed up. '}
          <a href="#app-settings">Back up now</a>
        </p>
      )}

      {vehicles.length === 0 ? (
        <section class="empty">
          <h2>Track your first vehicle</h2>
          <p>Log odometer readings and MilePulse works out how much you drive and when you will hit each milestone.</p>
          <button type="button" class="btn primary" onClick={() => setAdding(true)}>
            Add vehicle
          </button>
        </section>
      ) : (
        <ul class="cards">
          {vehicles.map((v) => {
            const stats = computeStats(readings.filter((r) => r.vehicleId === v.id));
            const next = stats && projectMilestones(stats, MILESTONE_INTERVAL[v.unit], 1)[0];
            return (
              <li key={v.id}>
                <a class="card" href={`#v-${v.id}`}>
                  <span class="card-name">{v.name}</span>
                  {stats ? (
                    <>
                      <span class="odo">
                        {fmt(stats.last.odometer)} <small>{v.unit}</small>
                      </span>
                      <span class="card-sub">
                        {next
                          ? `${fmt(next.odometer)} ${v.unit} around ${formatDate(next.date)}`
                          : `Last reading ${formatDate(stats.last.date)}`}
                      </span>
                    </>
                  ) : (
                    <span class="card-sub">No readings yet</span>
                  )}
                </a>
                <button
                  type="button"
                  class="quick-add"
                  aria-label={`Add reading for ${v.name}`}
                  onClick={() => setQuickAdd(v)}
                >
                  +
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <VehicleForm
          onClose={() => setAdding(false)}
          onDone={(v) => {
            location.hash = `#v-${v.id}`;
          }}
        />
      )}
      {quickAdd && (
        <ReadingForm
          vehicle={quickAdd}
          readings={readings.filter((r) => r.vehicleId === quickAdd.id)}
          onClose={() => setQuickAdd(null)}
          onDone={() => {
            setQuickAdd(null);
            void load();
          }}
        />
      )}
    </>
  );
}
