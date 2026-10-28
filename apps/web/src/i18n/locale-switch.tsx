'use client';

import { Button } from '@ticket/ui';
import { useAttendeeLocale } from './locale-context';

/** In-app VI/EN — cookie + catalog, not marketing `/en` rewrite. */
export function AttendeeLocaleSwitch() {
  const { locale, setLocale, t } = useAttendeeLocale();
  return (
    <div
      className="inline-flex shrink-0 items-center gap-1"
      role="group"
      aria-label={t('locale.label')}
      data-testid="attendee-locale-switch"
    >
      <Button
        type="button"
        size="sm"
        variant={locale === 'vi' ? 'brand' : 'secondary'}
        aria-pressed={locale === 'vi'}
        data-testid="attendee-locale-vi"
        onClick={() => setLocale('vi')}
      >
        {t('locale.vi')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={locale === 'en' ? 'brand' : 'secondary'}
        aria-pressed={locale === 'en'}
        data-testid="attendee-locale-en"
        onClick={() => setLocale('en')}
      >
        {t('locale.en')}
      </Button>
    </div>
  );
}
