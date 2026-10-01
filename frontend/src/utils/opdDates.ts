// Date helpers for booking and queue screens.
//
// The backend keys appointments and queue days on the Asia/Colombo calendar
// (see backend/models/receptionistFields.js `localDate`). A patient's phone may be
// set to a different timezone, so the client must not use its own local date
// or a Colombo booking can appear to be on the wrong day.

const HOSPITAL_TIME_ZONE = 'Asia/Colombo';

// "YYYY-MM-DD" for a given instant, in hospital time.
export function toDateKey(value: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HOSPITAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDaysKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function keyToUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

// "Today" / "Tomorrow" / "Fri, 3 Oct" — the wording used on the pass and booking
// cards, so patients do not have to read raw dates.
export function dayLabel(dateKey: string, today: string = todayKey()): string {
  if (dateKey === today) return 'Today';
  if (dateKey === addDaysKey(today, 1)) return 'Tomorrow';
  if (dateKey === addDaysKey(today, -1)) return 'Yesterday';

  return keyToUtcDate(dateKey).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function longDayLabel(dateKey: string): string {
  return keyToUtcDate(dateKey).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Weekday initials plus day number, for the horizontal day strip in booking.
export function shortDayParts(dateKey: string): { weekday: string; day: string; month: string } {
  const date = keyToUtcDate(dateKey);
  return {
    weekday: date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
    day: String(date.getUTCDate()),
    month: date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
  };
}

export function isPastDateKey(dateKey: string, today: string = todayKey()): boolean {
  return dateKey < today;
}

// "in 3 min" / "in 45 min" / "now" for the live wait, which reads better than a
// bare minute count while someone is actually standing in the clinic.
export function waitLabel(waitMinutes: number): string {
  if (waitMinutes <= 0) return 'Any moment now';
  if (waitMinutes < 60) return `About ${waitMinutes} min`;
  const hours = Math.floor(waitMinutes / 60);
  const minutes = waitMinutes % 60;
  return minutes ? `About ${hours}h ${minutes} min` : `About ${hours}h`;
}
