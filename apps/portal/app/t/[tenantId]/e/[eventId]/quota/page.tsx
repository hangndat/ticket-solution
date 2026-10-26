'use client';

import { StatisticCard } from '@ant-design/pro-components';
import { Alert, Button, Flex, Progress, Result, Spin } from 'antd';
import { PortalPage } from '../../../../../../src/components/portal-page';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  apiErrorMessage,
  portalGet,
} from '../../../../../../src/client/portal-fetch';
import { bffEventAction } from '../../../../../../src/prep/bff-urls';
import { isEventPagePermitted } from '../../../../../../src/prep/event-access-resolver';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { usePortalLocale } from '../../../../../../src/i18n';
import { SURFACE_MESSAGE_KEYS } from '../../../../../../src/prep/surface-copy';

type QuotaView = {
  capacity: number | null;
  allocated: number;
};

export default function QuotaPage() {
  const { t } = usePortalLocale();
  const params = useParams<{ tenantId: string; eventId: string }>();
  const { tenantId, eventId } = params;
  const access = useEventAccess(tenantId, eventId);
  const [quota, setQuota] = useState<QuotaView | null>(null);
  const [kind, setKind] = useState<'loading' | 'ready' | 'error' | 'unknown'>(
    'loading',
  );
  const [message, setMessage] = useState<string | undefined>();

  const load = useCallback(async () => {
    await Promise.resolve();
    setKind('loading');
    const res = await portalGet(bffEventAction(tenantId, eventId, 'quota'));
    if (res.networkError || res.timedOut || res.status >= 500) {
      setKind('unknown');
      setMessage(t('quota.h_ti22hj'));
      return;
    }
    if (res.status !== 200 || !res.json || typeof res.json !== 'object') {
      setKind('error');
      setMessage(
        apiErrorMessage(
          res.json,
          t('common.httpStatus', { status: res.status }),
        ),
      );
      return;
    }
    const body = res.json as Partial<QuotaView>;
    if (typeof body.allocated !== 'number') {
      setKind('unknown');
      setMessage(t('quota.h_dn1nvv'));
      return;
    }
    setQuota({
      capacity: body.capacity === undefined ? null : body.capacity,
      allocated: body.allocated,
    });
    setKind('ready');
  }, [tenantId, eventId, t]);

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

  if (access.kind === 'loading') return (
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
        subTitle={t('config.h_g7fjbz')}
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
  if (!isEventPagePermitted('quota', access.permissions)) {
    return (
      <Result
        status="403"
        title={t(SURFACE_MESSAGE_KEYS.permissionTitle)}
        subTitle={t('config.h_g7fjbz')}
        extra={
          <Button type="primary" onClick={() => {
          window.location.href = `/t/${tenantId}/e/${eventId}`;
        }}>
            {t(SURFACE_MESSAGE_KEYS.permissionGoAllowed)}
          </Button>
        }
      />
    );
  }

  const percent =
    quota && quota.capacity != null && quota.capacity > 0
      ? Math.min(100, Math.round((quota.allocated / quota.capacity) * 100))
      : undefined;

  return (
    <PortalPage
      title={t('nav.event.quota')}
      extra={<Button onClick={() => void load()}>{t('gate.h_3keb7')}</Button>}
      loading={kind === 'loading'}
    >
      {kind === 'loading' ? (
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
  ) : null}
      {kind === 'unknown' ? (
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
      ) : null}
      {kind === 'error' ? (
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
      ) : null}
      {kind === 'ready' && quota ? (
        <>
          <StatisticCard.Group>
            <StatisticCard
              statistic={{
                title: t('quota.h_1h6b62d'),
                value: quota.allocated,
              }}
            />
            <StatisticCard
              statistic={{
                title: 'Capacity',
                value:
                  quota.capacity === null ? t('quota.h_1tnoz3k') : quota.capacity,
              }}
            />
          </StatisticCard.Group>
          {percent !== undefined ? (
            <Progress percent={percent} status="active" style={{ marginTop: 16 }} />
          ) : (
            <Alert
              type="info"
              showIcon
              message={t('quota.capacityUnlimited')}
              style={{ marginTop: 16 }}
            />
          )}
        </>
      ) : null}
    </PortalPage>
  );
}
