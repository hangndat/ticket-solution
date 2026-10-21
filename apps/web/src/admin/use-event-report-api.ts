'use client';

import { useCallback, useState } from 'react';
import { interpretEventReport, type EventReportView } from './report';
import type { AdminScope } from './scope';
import { fetchJson } from '../redeem/fetch-json';
import { REQUEST_TIMEOUT_MS } from '../redeem/poll-operation';

type Params = {
  tenantId: string;
  eventId: string;
  scope: () => AdminScope;
  onBusy: (busy: boolean) => void;
  onBumpNotice: () => void;
  onClearSiblingViews: () => void;
  onClearDecision: () => void;
};

export function useEventReportApi({
  tenantId,
  eventId,
  scope,
  onBusy,
  onBumpNotice,
  onClearSiblingViews,
  onClearDecision,
}: Params) {
  const [reportHold, setReportHold] = useState<{
    tenantId: string;
    eventId: string;
    view: EventReportView;
  } | null>(null);

  const report =
    reportHold !== null &&
    reportHold.tenantId === tenantId.trim() &&
    reportHold.eventId === eventId.trim()
      ? reportHold.view
      : null;

  const clearReport = useCallback(() => {
    setReportHold(null);
  }, []);

  const loadReport = useCallback(async () => {
    const requestScope = scope();
    onBusy(true);
    setReportHold(null);
    onClearDecision();
    onClearSiblingViews();
    const params = new URLSearchParams(requestScope);
    const result = await fetchJson(
      `/api/bff/admin/report?${params.toString()}`,
      { method: 'GET' },
      REQUEST_TIMEOUT_MS,
    );
    onBumpNotice();
    setReportHold({
      tenantId: requestScope.tenantId,
      eventId: requestScope.eventId,
      view: interpretEventReport(
        result.status,
        result.json,
        result.networkError || result.timedOut,
      ),
    });
    onBusy(false);
  }, [
    onBumpNotice,
    onBusy,
    onClearDecision,
    onClearSiblingViews,
    scope,
  ]);

  return {
    report,
    clearReport,
    loadReport,
  };
}
