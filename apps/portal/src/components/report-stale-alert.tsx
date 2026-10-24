'use client';

import { Alert, Button } from 'antd';
import {
  formatReportAsOf,
  isReportDataStale,
} from '../ops/report';
import { usePortalLocale } from '../i18n';

export type ReportStaleAlertProps = {
  asOf: string;
  loading?: boolean;
  onRefresh: () => void;
};

export function ReportStaleAlert({
  asOf,
  loading,
  onRefresh,
}: ReportStaleAlertProps) {
  const { t, locale } = usePortalLocale();
  if (!isReportDataStale(asOf)) return null;

  const formatted = formatReportAsOf(asOf, locale);

  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
      data-testid="gate-report-stale"
      message={t('gate.report.staleTitle')}
      description={t('gate.report.staleDescription', { asOf: formatted })}
      action={
        <Button size="small" loading={loading} onClick={onRefresh}>
          {t('gate.h_3keb7')}
        </Button>
      }
    />
  );
}
