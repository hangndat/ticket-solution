import type { PortalLocale } from '../i18n/locale';
import { t } from '../i18n/t';
import type { PendingIntent } from './mutation-intent';

export function mutationIntentAlertCopy(
  state: PendingIntent['state'],
  needsReconciliation: boolean,
  locale: PortalLocale = 'vi',
): { message: string; description: string } {
  if (state === 'conflict') {
    return {
      message: t(locale, 'intent.conflictTitle'),
      description: t(locale, 'intent.conflictBody'),
    };
  }
  if (state === 'accepted') {
    return {
      message: t(locale, 'intent.acceptedTitle'),
      description: t(locale, 'intent.acceptedBody'),
    };
  }
  return {
    message: t(locale, 'intent.unknownTitle'),
    description: t(
      locale,
      needsReconciliation ? 'intent.unknownRecovered' : 'intent.unknownBody',
    ),
  };
}
