'use client';

import { Typography } from 'antd';
import { formatReportAsOf } from '../ops/report';
import { usePortalLocale } from '../i18n';

export function EventReportAsOfLine({ asOf }: { asOf: string }) {
  const { t, locale } = usePortalLocale();
  const formatted = formatReportAsOf(asOf, locale);

  return (
    <Typography.Text type="secondary" data-testid="event-report-as-of">
      {t('gate.report.dataThrough', { asOf: formatted })}
      {' '}
      <span className="utc-badge">UTC</span>
    </Typography.Text>
  );
}
