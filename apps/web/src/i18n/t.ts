import { DICTS, VI, type MessageKey } from './messages';
import {
  DEFAULT_ATTENDEE_LOCALE,
  type AttendeeLocale,
} from './locale';

export type { MessageKey };

export function t(locale: AttendeeLocale, key: MessageKey): string {
  const dict = DICTS[locale] ?? DICTS[DEFAULT_ATTENDEE_LOCALE];
  const primary = dict[key];
  if (typeof primary === 'string' && primary.length > 0) return primary;
  return VI[key];
}

export function isMessageKey(key: string): key is MessageKey {
  return Object.prototype.hasOwnProperty.call(VI, key);
}
