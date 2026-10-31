'use client';

import { attendeeSkip } from '../attendee-surface';
import { useAttendeeLocale } from './locale-context';

export function ProductSkipLink() {
  const { t } = useAttendeeLocale();
  return (
    <a className={attendeeSkip} href="#main">
      {t('nav.skip')}
    </a>
  );
}
