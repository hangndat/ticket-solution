/** Attendee product locales — default VI (O04); EN additive (O13 VI+EN). */
export type AttendeeLocale = 'vi' | 'en';

export const DEFAULT_ATTENDEE_LOCALE: AttendeeLocale = 'vi';

export const ATTENDEE_LOCALES: readonly AttendeeLocale[] = ['vi', 'en'] as const;

export function isAttendeeLocale(value: unknown): value is AttendeeLocale {
  return value === 'vi' || value === 'en';
}

export function parseAttendeeLocale(
  value: unknown,
  fallback: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
): AttendeeLocale {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'en' || normalized === 'en-us' || normalized === 'en_us') {
    return 'en';
  }
  if (normalized === 'vi' || normalized === 'vi-vn' || normalized === 'vi_vn') {
    return 'vi';
  }
  return fallback;
}
