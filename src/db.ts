import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Backup } from './domain/backup';
import type { Reading, Vehicle } from './domain/types';

interface MilePulseDB extends DBSchema {
  vehicles: { key: string; value: Vehicle };
  readings: { key: string; value: Reading; indexes: { vehicleId: string } };
}

let dbPromise: Promise<IDBPDatabase<MilePulseDB>> | null = null;

function db(): Promise<IDBPDatabase<MilePulseDB>> {
  dbPromise ??= openDB<MilePulseDB>('milepulse', 1, {
    upgrade(database) {
      // Version 1. Add later stores (trips, services) under a new version number.
      database.createObjectStore('vehicles', { keyPath: 'id' });
      const readings = database.createObjectStore('readings', { keyPath: 'id' });
      readings.createIndex('vehicleId', 'vehicleId');
    },
  });
  return dbPromise;
}

/** Asks the browser not to evict our data under storage pressure. Safe to call repeatedly. */
export async function requestPersistence(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Not supported; data still saves normally.
  }
}

export async function listVehicles(): Promise<Vehicle[]> {
  const all = await (await db()).getAll('vehicles');
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getVehicle(id: string): Promise<Vehicle | undefined> {
  return (await db()).get('vehicles', id);
}

export async function saveVehicle(vehicle: Vehicle): Promise<void> {
  await (await db()).put('vehicles', vehicle);
}

export async function deleteVehicle(id: string): Promise<void> {
  const tx = (await db()).transaction(['vehicles', 'readings'], 'readwrite');
  await tx.objectStore('vehicles').delete(id);
  const keys = await tx.objectStore('readings').index('vehicleId').getAllKeys(id);
  await Promise.all(keys.map((k) => tx.objectStore('readings').delete(k)));
  await tx.done;
}

export async function listReadings(vehicleId: string): Promise<Reading[]> {
  return (await db()).getAllFromIndex('readings', 'vehicleId', vehicleId);
}

export async function listAllReadings(): Promise<Reading[]> {
  return (await db()).getAll('readings');
}

export async function saveReading(reading: Reading): Promise<void> {
  await (await db()).put('readings', reading);
}

export async function deleteReading(id: string): Promise<void> {
  await (await db()).delete('readings', id);
}

/** Replaces everything in the database with the contents of a backup. */
export async function restoreBackup(backup: Backup): Promise<void> {
  const tx = (await db()).transaction(['vehicles', 'readings'], 'readwrite');
  await tx.objectStore('vehicles').clear();
  await tx.objectStore('readings').clear();
  await Promise.all([
    ...backup.vehicles.map((v) => tx.objectStore('vehicles').put(v)),
    ...backup.readings.map((r) => tx.objectStore('readings').put(r)),
  ]);
  await tx.done;
}
