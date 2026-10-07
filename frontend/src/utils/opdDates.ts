// Date helpers for booking and queue screens.
//
// The backend keys appointments and queue days on the Asia/Colombo calendar
// (see backend/models/receptionistFields.js `localDate`). A patient's phone may be
// set to a different timezone, so the client must not use its own local date
// or a Colombo booking can appear to be on the wrong day.

import { translate, type Language } from '../i18n/translations';

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
export function dayLabel(dateKey: string, today: string = todayKey(), locale = 'en-GB'): string {
  const language: Language = locale.startsWith('si') ? 'si' : locale.startsWith('ta') ? 'ta' : 'en';
  if (dateKey === today) return translate(language, 'Today');
  if (dateKey === addDaysKey(today, 1)) return translate(language, 'Tomorrow');
  if (dateKey === addDaysKey(today, -1)) return translate(language, 'Yesterday');

  return keyToUtcDate(dateKey).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function longDayLabel(dateKey: string, locale = 'en-GB'): string {
  return keyToUtcDate(dateKey).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// A clear date for forms and report details, without exposing the storage
// format used by the date input and API.
export function calendarDateLabel(dateKey: string | null | undefined, locale = 'en-GB'): string | null {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  return keyToUtcDate(dateKey).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Weekday initials plus day number, for the horizontal day strip in booking.
export function shortDayParts(dateKey: string, locale = 'en-GB'): { weekday: string; day: string; month: string } {
  const date = keyToUtcDate(dateKey);
  return {
    weekday: date.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' }),
    day: String(date.getUTCDate()),
    month: date.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }),
  };
}

export function isPastDateKey(dateKey: string, today: string = todayKey()): boolean {
  return dateKey < today;
}

// "in 3 min" / "in 45 min" / "now" for the live wait, which reads better than a
// bare minute count while someone is actually standing in the clinic.
export function waitLabel(waitMinutes: number, language: Language = 'en'): string {
  if (waitMinutes <= 0) return translate(language, 'Any moment now');
  if (waitMinutes < 60) return translate(language, 'About {minutes} min', { minutes: waitMinutes });
  const hours = Math.floor(waitMinutes / 60);
  const minutes = waitMinutes % 60;
  return minutes ? translate(language, 'About {hours}h {minutes} min', { hours, minutes }) : translate(language, 'About {hours}h', { hours });
}

// "6 Mar 2026" for report and history dates. These arrive as full ISO
// timestamps rather than "YYYY-MM-DD" keys, so they are formatted in the
// patient's own timezone: a report dated at the clinic should read as the day
// the patient experienced it, not a day shifted by the phone's timezone.
export function timestampLabel(iso: string | null | undefined, locale = 'en-GB'): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// "Today" / "3 days ago" for the activity feed, where the exact date matters
// less than how recent something is.
export function relativeTimestampLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return timestampLabel(iso);

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? 'An hour ago' : `${hours} hours ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return timestampLabel(iso);
}

// An ISO timestamp to the "YYYY-MM-DD" value a date input expects. The
// conversion happens in local time to match what the patient sees in the field.
export function isoToInputDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
