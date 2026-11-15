const LAST_BACKUP_KEY = 'milepulse.lastBackup';

/** Local date (YYYY-MM-DD) of the last backup export on this device, or null. */
export function getLastBackup(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

export function setLastBackup(date: string): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, date);
  } catch {
    // Storage unavailable; the nudge simply keeps showing.
  }
}
