import { useRef, useState } from 'preact/hooks';
import { listAllReadings, listVehicles, restoreBackup } from '../db';
import { describeBackupAge, makeBackup, parseBackup, type Backup } from '../domain/backup';
import { todayIso } from '../domain/dates';
import { getLastBackup, setLastBackup } from '../settings';
import { downloadFile } from './util';

export function Settings() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const [lastBackup, setLast] = useState(getLastBackup());
  const [pending, setPending] = useState<Backup | null>(null);
  const summarize = (b: Backup) => `${b.vehicles.length} vehicles and ${b.readings.length} readings`;

  async function exportBackup() {
    const [vehicles, readings] = await Promise.all([listVehicles(), listAllReadings()]);
    const backup = makeBackup(vehicles, readings);
    downloadFile(`milepulse-backup-${todayIso()}.json`, 'application/json', JSON.stringify(backup, null, 2));
    setLastBackup(todayIso());
    setLast(todayIso());
    setMessage({ text: `Exported ${vehicles.length} vehicles and ${readings.length} readings.` });
  }

  async function importBackup(file: File) {
    try {
      setMessage(null);
      setPending(parseBackup(await file.text()));
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Import failed.', bad: true });
    }
  }

  return (
    <>
      <header class="page-head">
        <h1>Settings</h1>
      </header>

      <section>
        <h2>Backup</h2>
        <p class="hint">
          Your data is stored only on this device. Export a backup regularly, and before switching phones or
          clearing browser data.
        </p>
        <p class="hint">Last backup: {describeBackupAge(lastBackup, todayIso())}</p>
        <div class="stack">
          <button type="button" class="btn primary" onClick={exportBackup}>
            Export backup
          </button>
          <button type="button" class="btn" onClick={() => fileInput.current?.click()}>
            Import backup
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (file) void importBackup(file);
            }}
          />
        </div>
        {pending && (
          <div class="stack">
            <p class="hint">Replace everything on this device with {summarize(pending)} from the backup?</p>
            <button
              type="button"
              class="btn danger"
              onClick={async () => {
                await restoreBackup(pending);
                setLastBackup(todayIso()); // this device now matches a backup file you hold
                setLast(todayIso());
                setMessage({ text: `Restored ${summarize(pending)}.` });
                setPending(null);
              }}
            >
              Replace my data
            </button>
            <button type="button" class="btn" onClick={() => setPending(null)}>
              Keep my data
            </button>
          </div>
        )}
        {message && (
          <p class={message.bad ? 'error' : 'hint'} role="status">
            {message.text}
          </p>
        )}
      </section>

      <section>
        <h2>About</h2>
        <p class="hint">MilePulse {__APP_VERSION__}. No account, no tracking, works offline.</p>
      </section>
    </>
  );
}
