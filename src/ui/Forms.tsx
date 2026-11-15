import { useState } from 'preact/hooks';
import { deleteReading, deleteVehicle, requestPersistence, saveReading, saveVehicle } from '../db';
import { todayIso } from '../domain/dates';
import { validateReading } from '../domain/projection';
import { newId, UNIT_LABEL, type Reading, type Unit, type Vehicle } from '../domain/types';
import { Sheet } from './Sheet';
import { parseNumber } from './util';

interface VehicleFormProps {
  vehicle?: Vehicle;
  onClose: () => void;
  /** Called after a save; `deleted` is true when the vehicle was removed. */
  onDone: (vehicle: Vehicle, deleted?: boolean) => void;
}

export function VehicleForm({ vehicle, onClose, onDone }: VehicleFormProps) {
  const today = todayIso();
  const [name, setName] = useState(vehicle?.name ?? '');
  const [unit, setUnit] = useState<Unit>(vehicle?.unit ?? 'mi');
  const [odometer, setOdometer] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseOdo, setPurchaseOdo] = useState('');
  const [error, setError] = useState('');
  const [armed, setArmed] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError('Give the vehicle a name.');

    if (vehicle) {
      const updated = { ...vehicle, name: trimmed };
      await saveVehicle(updated);
      return onDone(updated);
    }

    const created: Vehicle = { id: newId(), name: trimmed, unit, createdAt: new Date().toISOString() };
    const initial: Reading[] = [];
    if (purchaseDate || purchaseOdo.trim()) {
      if (!purchaseDate || !purchaseOdo.trim()) {
        return setError('Enter both the purchase date and the odometer at purchase, or leave both blank.');
      }
      const value = parseNumber(purchaseOdo);
      const problem = validateReading([], { date: purchaseDate, odometer: value, isPurchase: true }, today);
      if (problem) return setError(problem);
      initial.push({ id: newId(), vehicleId: created.id, date: purchaseDate, odometer: value, isPurchase: true });
    }
    if (odometer.trim()) {
      if (purchaseDate === today) {
        return setError('The purchase date is today, so leave "Odometer today" blank.');
      }
      const value = parseNumber(odometer);
      const problem = validateReading(initial, { date: today, odometer: value }, today);
      if (problem) return setError(problem);
      initial.push({ id: newId(), vehicleId: created.id, date: today, odometer: value });
    }
    await saveVehicle(created);
    for (const reading of initial) await saveReading(reading);
    void requestPersistence();
    onDone(created);
  }

  async function remove() {
    if (!vehicle) return;
    if (!armed) return setArmed(true);
    await deleteVehicle(vehicle.id);
    onDone(vehicle, true);
  }

  return (
    <Sheet title={vehicle ? 'Edit vehicle' : 'Add vehicle'} onClose={onClose}>
      <form onSubmit={submit} class="form">
        <label>
          Name
          <input
            value={name}
            onInput={(e) => setName(e.currentTarget.value)}
            placeholder="e.g. Blue Tacoma"
            maxLength={40}
            autoFocus
          />
        </label>

        {vehicle ? (
          <p class="hint">Odometer unit: {UNIT_LABEL[vehicle.unit]}. The unit is fixed once a vehicle is created.</p>
        ) : (
          <>
            <fieldset class="segmented">
              <legend>Odometer unit</legend>
              {(['mi', 'km'] as const).map((u) => (
                <label key={u} class={unit === u ? 'on' : ''}>
                  <input type="radio" name="unit" checked={unit === u} onChange={() => setUnit(u)} />
                  {UNIT_LABEL[u]}
                </label>
              ))}
            </fieldset>
            <label>
              Odometer today ({unit})
              <input
                name="odoToday"
                value={odometer}
                onInput={(e) => setOdometer(e.currentTarget.value)}
                inputMode="decimal"
                placeholder="e.g. 46480"
              />
            </label>
            <div class="row">
              <label>
                Purchase date
                <input
                  name="purchaseDate"
                  type="date"
                  value={purchaseDate}
                  max={today}
                  onInput={(e) => setPurchaseDate(e.currentTarget.value)}
                />
              </label>
              <label>
                Odometer at purchase
                <input
                  name="purchaseOdo"
                  value={purchaseOdo}
                  onInput={(e) => setPurchaseOdo(e.currentTarget.value)}
                  inputMode="decimal"
                  placeholder="e.g. 41250"
                />
              </label>
            </div>
            <p class="hint">
              Purchase details are optional, but with both they give projections right away. Without them, add a
              second reading on a later date.
            </p>
          </>
        )}

        {error && <p class="error" role="alert">{error}</p>}
        <button type="submit" class="btn primary">
          {vehicle ? 'Save' : 'Add vehicle'}
        </button>
        {vehicle && (
          <button type="button" class="btn danger" onClick={remove}>
            {armed ? 'Tap again to delete the vehicle and all its readings' : 'Delete vehicle'}
          </button>
        )}
      </form>
    </Sheet>
  );
}

interface ReadingFormProps {
  vehicle: Vehicle;
  readings: Reading[];
  reading?: Reading;
  onClose: () => void;
  onDone: () => void;
}

export function ReadingForm({ vehicle, readings, reading, onClose, onDone }: ReadingFormProps) {
  const today = todayIso();
  const [date, setDate] = useState(reading?.date ?? today);
  const [odometer, setOdometer] = useState(reading ? String(reading.odometer) : '');
  const [note, setNote] = useState(reading?.note ?? '');
  // The purchase marker is set during vehicle setup; editing keeps it as is.
  const isPurchase = reading?.isPurchase === true;
  const [error, setError] = useState('');
  const [armed, setArmed] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    const value = parseNumber(odometer);
    const problem = validateReading(readings, { id: reading?.id, date, odometer: value, isPurchase }, today);
    if (problem) return setError(problem);
    const trimmedNote = note.trim();
    await saveReading({
      id: reading?.id ?? newId(),
      vehicleId: vehicle.id,
      date,
      odometer: value,
      ...(trimmedNote ? { note: trimmedNote } : {}),
      ...(isPurchase ? { isPurchase: true as const } : {}),
    });
    void requestPersistence();
    onDone();
  }

  async function remove() {
    if (!reading) return;
    if (!armed) return setArmed(true);
    await deleteReading(reading.id);
    onDone();
  }

  return (
    <Sheet title={reading ? 'Edit reading' : 'Add reading'} onClose={onClose}>
      <form onSubmit={submit} class="form">
        <div class="row">
          <label>
            Odometer ({vehicle.unit})
            <input
              value={odometer}
              onInput={(e) => setOdometer(e.currentTarget.value)}
              inputMode="decimal"
              placeholder="e.g. 45200"
              autoFocus
            />
          </label>
          <label>
            Date
            <input type="date" value={date} max={today} onInput={(e) => setDate(e.currentTarget.value)} />
          </label>
        </div>
        <label>
          Note (optional)
          <input value={note} onInput={(e) => setNote(e.currentTarget.value)} maxLength={120} placeholder="e.g. Oil change" />
        </label>
        {error && <p class="error" role="alert">{error}</p>}
        <button type="submit" class="btn primary">
          Save reading
        </button>
        {reading && (
          <button type="button" class="btn danger" onClick={remove}>
            {armed ? 'Tap again to delete' : 'Delete reading'}
          </button>
        )}
      </form>
    </Sheet>
  );
}
