function parts(date: Date, timeZone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

export function plainDateInZone(date: Date, timeZone: string): string {
  const value = parts(date, timeZone);
  return `${value.year}-${value.month}-${value.day}`;
}

export function localInputToUtc(value: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Selecciona una fecha y hora válidas');
  const [, year, month, day, hour, minute] = match;
  const target = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  let guess = target;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const represented = parts(new Date(guess), timeZone);
    const representedUtc = Date.UTC(Number(represented.year), Number(represented.month) - 1, Number(represented.day), Number(represented.hour), Number(represented.minute));
    guess -= representedUtc - target;
  }
  const check = parts(new Date(guess), timeZone);
  if (check.year !== year || check.month !== month || check.day !== day || check.hour !== hour || check.minute !== minute) throw new Error('Esa hora no existe en la zona horaria seleccionada');
  return new Date(guess).toISOString();
}

function addPlainDays(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function firstInstantOfLocalDay(date: string, timeZone: string): string {
  for (let hour = 0; hour < 4; hour += 1) {
    try {
      return localInputToUtc(`${date}T${String(hour).padStart(2, '0')}:00`, timeZone);
    } catch {
      // Algunos cambios de horario de verano eliminan la medianoche local.
    }
  }
  throw new Error('No se pudo interpretar esa fecha en la zona horaria seleccionada');
}

/** Límites UTC inclusivos de un día civil en una zona horaria concreta. */
export function localDateBoundsUtc(date: string, timeZone: string): { from: string; to: string } {
  const from = firstInstantOfLocalDay(date, timeZone);
  const nextDay = firstInstantOfLocalDay(addPlainDays(date, 1), timeZone);
  return { from, to: new Date(new Date(nextDay).getTime() - 1).toISOString() };
}

/** Convierte una fecha del navegador al inicio o final inclusivo del día. */
export function browserDateBoundaryUtc(date: string, end = false): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = end
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
  if (Number.isNaN(value.getTime())) throw new Error('Fecha inválida');
  return value.toISOString();
}
