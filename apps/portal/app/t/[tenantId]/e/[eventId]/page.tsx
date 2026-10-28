'use client';

import { ProCard, StatisticCard } from '@ant-design/pro-components';
import { Alert, Button, Descriptions, Flex, Result, Space, Spin, Typography } from 'antd';
import { PortalPage } from '../../../../../src/components/portal-page';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ConfigVersionSummary, EventDetail } from '@ticket/contracts';
import {
  apiErrorMessage,
  portalGet,
} from '../../../../../src/client/portal-fetch';
import { bffEvent, bffEventAction } from '../../../../../src/prep/bff-urls';
import {
  derivePrepReadiness,
  readinessAllOk,
  readinessSummary,
  type PrepReadinessKey,
} from '../../../../../src/prep/readiness';
import { useEventAccess } from '../../../../../src/prep/use-event-access';
import {
  canAccessEventRoute,
  canPerformEventAction,
} from '../../../../../src/nav/capability-policy';
import {
  interpretEventReport,
  reportEmailCsHref,
  reportPendingApprovalHref,
  reportShowsEmailCsCta,
  reportShowsPendingApprovalCta,
  type EventReportView,
} from '../../../../../src/ops/report';
import { GateDeeplinkButton } from '../../../../../src/components/gate-deeplink';
import { gateDeeplinkUrl } from '../../../../../src/oidc/config';
import { EventReportAsOfLine } from '../../../../../src/components/event-report-as-of';
import { ReadinessChecklist } from '../../../../../src/components/readiness-checklist';
import { ReportStaleAlert } from '../../../../../src/components/report-stale-alert';
import {
  formatEventBusinessStatus,
  formatEventContentStatus,
  formatEventVisibility,
  usePortalLocale,
} from '../../../../../src/i18n';
import { SURFACE_MESSAGE_KEYS } from '../../../../../src/prep/surface-copy';
export default function EventOverviewPage() {
  const { t, locale } = usePortalLocale();
  const params = useParams<{ tenantId: string; eventId: string }>();
  const { tenantId, eventId } = params;
  const access = useEventAccess(tenantId, eventId);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [report, setReport] = useState<EventReportView | null>(null);
  const [typesCount, setTypesCount] = useState<number | null>(null);
  const [sourcesCount, setSourcesCount] = useState<number | null>(null);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [hasBrand, setHasBrand] = useState<boolean | null>(null);
  const [hasTerms, setHasTerms] = useState<boolean | null>(null);
  const [forbiddenReadiness, setForbiddenReadiness] = useState<PrepReadinessKey[]>([]);
  const [loadKind, setLoadKind] = useState<
    'loading' | 'ready' | 'error' | 'unknown' | 'forbidden'
  >('loading');
  const [message, setMessage] = useState<string | undefined>();
  const [reportBusy, setReportBusy] = useState(false);

  const refreshReport = useCallback(async () => {
    setReportBusy(true);
    const r = await portalGet(bffEventAction(tenantId, eventId, 'report'));
    setReport(
      interpretEventReport(
        r.status,
        r.json,
        r.networkError || r.timedOut,
        locale,
      ),
    );
    setReportBusy(false);
  }, [tenantId, eventId, locale]);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoadKind('loading');
    setTypesCount(null);
    setSourcesCount(null);
    setPublishedVersion(null);
    setDraftVersion(null);
    setHasBrand(null);
    setHasTerms(null);
    setForbiddenReadiness([]);
    const [d, r, ty, s, c] = await Promise.all([
      portalGet(bffEvent(tenantId, eventId)),
      portalGet(bffEventAction(tenantId, eventId, 'report')),
      portalGet(
        `${bffEventAction(tenantId, eventId, 'ticket-types')}?limit=20`,
      ),
      portalGet(`${bffEventAction(tenantId, eventId, 'sources')}?limit=20`),
      portalGet(bffEventAction(tenantId, eventId, 'config-versions')),
    ]);

    if (d.networkError || d.timedOut || d.status >= 500 || d.status === 0) {
      setLoadKind('unknown');
      setMessage(t('common.h_1hj59zg'));
      return;
    }
    if (d.status === 403) {
      setLoadKind('forbidden');
      return;
    }
    if (d.status !== 200 || !d.json || typeof d.json !== 'object') {
      setLoadKind('error');
      setMessage(
        apiErrorMessage(d.json, t('common.httpStatus', { status: d.status })),
      );
      return;
    }
    setDetail(d.json as EventDetail);

    setReport(
      interpretEventReport(
        r.status,
        r.json,
        r.networkError || r.timedOut,
        locale,
      ),
    );

    const tItems =
      ty.status === 200 &&
      ty.json &&
      typeof ty.json === 'object' &&
      Array.isArray((ty.json as { items?: unknown }).items)
        ? ((ty.json as { items: unknown[] }).items as unknown[])
        : [];
    const sItems =
      s.status === 200 &&
      s.json &&
      typeof s.json === 'object' &&
      Array.isArray((s.json as { items?: unknown }).items)
        ? ((s.json as { items: unknown[] }).items as unknown[])
        : [];
    if (ty.status === 200 && Array.isArray((ty.json as { items?: unknown } | null)?.items)) {
      setTypesCount(tItems.length);
    }
    if (s.status === 200 && Array.isArray((s.json as { items?: unknown } | null)?.items)) {
      setSourcesCount(sItems.length);
    }

    const forbidden: PrepReadinessKey[] = [];
    if (r.status === 403) forbidden.push('quota');
    if (ty.status === 403) forbidden.push('types');
    if (s.status === 403) forbidden.push('sources');
    if (c.status === 403) forbidden.push('form', 'brand');

    if (c.status === 200 && c.json && typeof c.json === 'object') {
      const validItems = Array.isArray((c.json as { items?: unknown }).items);
      const items = validItems
        ? ((c.json as { items: ConfigVersionSummary[] })
            .items as ConfigVersionSummary[])
        : [];
      const published = items.find((i) => i.published);
      if (validItems) {
        setPublishedVersion(published?.version ?? null);
        setDraftVersion(items[0]?.version ?? null);
        if (!items[0]) {
          setHasBrand(false);
          setHasTerms(false);
        }
      }
      if (validItems && items[0]) {
        const preview = await portalGet(
          `${bffEventAction(tenantId, eventId, 'config-versions')}/${items[0].version}/preview`,
        );
        if (preview.status === 403) {
          forbidden.push('form', 'brand');
        } else if (
          preview.status === 200 &&
          preview.json &&
          typeof preview.json === 'object'
        ) {
          const payload = (preview.json as { payload?: unknown }).payload;
          if (payload && typeof payload === 'object') {
            const brand = (
              payload as {
                brand?: { organizationName?: string; primaryColor?: string };
              }
            ).brand;
            setHasBrand(
              Boolean(
                brand?.organizationName?.trim() && brand?.primaryColor?.trim(),
              ),
            );
            const sections = (
              payload as {
                sections?: Array<{
                  kind: string;
                  body?: Record<string, unknown>;
                }>;
              }
            ).sections;
            const terms = sections?.find((sec) => sec.kind === 'terms');
            const body = terms?.body ?? {};
            setHasTerms(
              Boolean(
                (typeof body.termsVersion === 'string' &&
                  body.termsVersion.trim()) ||
                (typeof body.text === 'string' && body.text.trim()) ||
                published,
              ),
            );
          }
        }
      }
    }
    setForbiddenReadiness(forbidden);

    setLoadKind('ready');
  }, [tenantId, eventId, locale, t]);

  useEffect(() => {
    if (access.kind !== 'ready') return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [access.kind, load]);

  const shownReport = report?.kind === 'shown' ? report : null;
  const readiness = useMemo(
    () =>
      derivePrepReadiness(
        {
          hasEventContext: true,
          hasTicketType: typesCount == null ? 'unknown' : typesCount > 0,
          hasSource: sourcesCount == null ? 'unknown' : sourcesCount > 0,
          quotaKnown: shownReport?.quota !== undefined,
          quotaCapacity: shownReport?.quota?.capacity ?? null,
          hasTermsOrPublished:
            hasTerms == null && publishedVersion == null
              ? 'unknown'
              : Boolean(hasTerms || publishedVersion != null),
          hasBrand: hasBrand == null ? 'unknown' : hasBrand,
          forbiddenKeys: forbiddenReadiness,
        },
        locale,
      ),
    [
      typesCount,
      sourcesCount,
      shownReport,
      hasTerms,
      publishedVersion,
      hasBrand,
      forbiddenReadiness,
      locale,
    ],
  );
  const canPublish =
    readinessAllOk(readiness) &&
    draftVersion != null &&
    access.kind === 'ready' &&
    canPerformEventAction('publishConfig', access.permissions);

  if (access.kind === 'error') {
    return (
      <Alert
        type="error"
        showIcon
        message={t(SURFACE_MESSAGE_KEYS.errorLoadFailed)}
        description={access.messageKey ? t(access.messageKey) : undefined}
        action={
          <Button size="small" onClick={() => window.location.reload()}>
            {t(SURFACE_MESSAGE_KEYS.retry)}
          </Button>
        }
        style={{ margin: 24 }}
      />
    );
  }
  if (access.kind === 'permission-denied') {
    return (
      <Result
        status="403"
        title={t(SURFACE_MESSAGE_KEYS.permissionTitle)}
        subTitle={t('common.h_1rsax7j')}
        extra={
          <Button type="primary" onClick={() => {
          window.location.href = `/t/${tenantId}`;
        }}>
            {t(SURFACE_MESSAGE_KEYS.permissionGoAllowed)}
          </Button>
        }
      />
    );
  }
  if (access.kind === 'loading' || loadKind === 'loading') {
    return (
    <Flex
      vertical
      align="center"
      gap="middle"
      role="status"
      aria-busy="true"
      aria-label={t(SURFACE_MESSAGE_KEYS.loading)}
      suppressHydrationWarning
      style={{ padding: 48 }}
    >
      <Spin size="large" />
      <span>{t(SURFACE_MESSAGE_KEYS.loading)}</span>
    </Flex>
  );
  }
  if (loadKind === 'unknown') {
    return (
      <Alert
        type="warning"
        showIcon
        message={t('surface.unknown.title')}
        description={message}
        action={
          <Button size="small" onClick={() => void load()}>
            {t('surface.action.recheck')}
          </Button>
        }
      />
    );
  }
  if (loadKind === 'forbidden') {
    return (
      <Result
        status="403"
        title={t(SURFACE_MESSAGE_KEYS.permissionTitle)}
        subTitle={t('surface.permission.defaultDescription')}
      />
    );
  }
  if (loadKind === 'error' || !detail) {
    return (
      <Alert
        type="error"
        showIcon
        message={t(SURFACE_MESSAGE_KEYS.errorLoadFailed)}
        description={message}
        action={
          <Button size="small" onClick={() => void load()}>
            {t(SURFACE_MESSAGE_KEYS.retry)}
          </Button>
        }
        style={{ margin: 24 }}
      />
    );
  }

  const canScan = access.permissions.includes('gate.confirm');
  const canReport = access.permissions.includes('report.read');

  return (
    <PortalPage
      title={detail.name}
      subTitle={t('common.h_1nl7gld')}
      extra={
        <Space>
          {canAccessEventRoute('setup', access.permissions) ? (
            <Link href={`/t/${tenantId}/e/${eventId}/setup`}>
              <Button>{t('nav.event.setup')}</Button>
            </Link>
          ) : null}
          <Link href={`/t/${tenantId}/e/${eventId}/config`}>
            <Button>{t('nav.org.settings')}</Button>
          </Link>
          {canPublish ? (
            <Link href={`/t/${tenantId}/e/${eventId}/config`}>
              <Button type="primary">{t('event.home.openPublish')}</Button>
            </Link>
          ) : (
            <Button type="primary" disabled title={readinessSummary(readiness, locale)}>
              {t('event.home.openPublish')}
            </Button>
          )}
        </Space>
      }
    >
      <ProCard
        size="small"
        title={t('ops.export.statusButton')}
        style={{ marginBottom: 16 }}
      >
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label={t('common.label.slug')}>
            {detail.slug}
          </Descriptions.Item>
          <Descriptions.Item label={t('common.h_fe18yl')}>
            {formatEventContentStatus(locale, detail.contentStatus)}
          </Descriptions.Item>
          <Descriptions.Item label={t('common.h_1t15e7z')}>
            {formatEventBusinessStatus(locale, detail.businessStatus)}
          </Descriptions.Item>
          <Descriptions.Item label={t('common.h_wqd4fq')}>
            {formatEventVisibility(locale, detail.visibility)}
          </Descriptions.Item>
          <Descriptions.Item label={t('common.label.revision')}>
            {detail.revision}
          </Descriptions.Item>
          <Descriptions.Item label={t('common.h_qqix4u')}>
            {publishedVersion ?? '—'}
          </Descriptions.Item>
        </Descriptions>
      </ProCard>

      <ProCard size="small" style={{ marginBottom: 16 }}>
        <ReadinessChecklist
          title={t('common.h_4nfgg4')}
          summary={readinessSummary(readiness, locale)}
          items={readiness}
        />
      </ProCard>

      {shownReport ? (
        <ProCard
          size="small"
          title={t('gate.reportQuickTitle')}
          subTitle={<EventReportAsOfLine asOf={shownReport.asOf} />}
          style={{ marginBottom: 16 }}
        >
          <ReportStaleAlert
            asOf={shownReport.asOf}
            loading={reportBusy}
            onRefresh={() => void refreshReport()}
          />
          <StatisticCard.Group className="portal-gate-report-compact">
            <StatisticCard
              statistic={{
                title: t('gate.stat.quotaAllocated'),
                value: shownReport.quota.allocated,
              }}
            />
            <StatisticCard
              statistic={{
                title: t('gate.stat.capacity'),
                value:
                  shownReport.quota.capacity === null
                    ? '∞'
                    : shownReport.quota.capacity,
              }}
            />
            <StatisticCard
              statistic={{
                title: t('gate.h_1nc3sip'),
                value: shownReport.pendingApprovalCount,
              }}
            />
            <StatisticCard
              statistic={{
                title: t('gate.stat.checkInOk'),
                value: shownReport.checkInSuccessCount,
              }}
            />
          </StatisticCard.Group>
          <Space wrap style={{ marginTop: 8 }}>
            <Button size="small" onClick={() => void load()}>
              {t('gate.h_3keb7')}
            </Button>
            {reportShowsPendingApprovalCta(shownReport) ? (
              <Link href={reportPendingApprovalHref(tenantId, eventId)}>
                <Button size="small">{t('common.h_wa3fk5')}</Button>
              </Link>
            ) : null}
            {reportShowsEmailCsCta(shownReport) ? (
              <Link href={reportEmailCsHref(tenantId, eventId)}>
                <Button size="small">{t('common.h_1pfzepi')}</Button>
              </Link>
            ) : null}
            <Link href={`/t/${tenantId}/e/${eventId}/guests`}>
              <Button size="small">{t('nav.event.guests')}</Button>
            </Link>
          </Space>
        </ProCard>
      ) : canReport ? (
        <Alert
          type="warning"
          showIcon
          message={t('common.h_1cdrhuc')}
          description={
            report?.kind === 'rejected'
              ? t('ops.export.apiRejected', {
                  code: report.code,
                  message: report.message,
                })
              : report?.kind === 'unknown'
                ? report.message
                : undefined
          }
        />
      ) : null}


      {canScan ? (
        <GateDeeplinkButton
          href={gateDeeplinkUrl(undefined, '/gate', { tenantId, eventId })}
        />
      ) : null}

      {canReport ? (
        <Typography.Paragraph>
          {t('event.home.gateReportDetail')}{' '}
          <Link href={`/t/${tenantId}/e/${eventId}/gate`}>
            {t('common.h_1iov4lt')}
          </Link>
          {t('gateDeeplink.h_k7571i')}
        </Typography.Paragraph>
      ) : null}
    </PortalPage>
  );
}
