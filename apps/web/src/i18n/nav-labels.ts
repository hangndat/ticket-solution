import type { AttendeeLocale } from './locale';
import type { MessageKey } from './messages';
import { t } from './t';

const TEST_ID_TO_KEY: Record<string, MessageKey> = {
  'nav-events': 'nav.events',
  'nav-redeem': 'nav.redeem',
  'nav-login': 'nav.login',
  'nav-wallet': 'nav.wallet',
  'nav-account': 'nav.account',
};

export function navLabelForTestId(
  testId: string,
  locale: AttendeeLocale,
  fallback: string,
): string {
  const key = TEST_ID_TO_KEY[testId];
  if (!key) return fallback;
  return t(locale, key);
}
