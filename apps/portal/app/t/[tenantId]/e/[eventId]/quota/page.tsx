'use client';

import { Alert, Button, Descriptions, Progress, Space, Typography } from 'antd';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  apiErrorMessage,
  portalGet,
} from '../../../../../../src/client/portal-fetch';
import { bffEventAction } from '../../../../../../src/prep/bff-urls';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { SurfaceState } from '../../../../../../src/components/surface-state';
import { usePortalLocale } from '../../../../../../src/i18n';

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

  if (access.kind === 'loading') return <SurfaceState kind="loading" />;
  if (access.kind === 'error') {
    return (
      <SurfaceState
        kind="error"
        description={access.messageKey ? t(access.messageKey) : undefined}
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (access.kind === 'permission-denied') {
    return (
      <SurfaceState
        kind="permission-denied"
        description={t('config.h_g7fjbz')}
        onRetry={() => {
          window.location.href = `/t/${tenantId}`;
        }}
      />
    );
  }

  const percent =
    quota && quota.capacity != null && quota.capacity > 0
      ? Math.min(100, Math.round((quota.allocated / quota.capacity) * 100))
      : undefined;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('nav.event.quota')}
        </Typography.Title>
        <Button onClick={() => void load()}>{t('gate.h_3keb7')}</Button>
      </Space>

      {kind === 'loading' ? <SurfaceState kind="loading" /> : null}
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
        <SurfaceState
          kind="error"
          description={message}
          onRetry={() => void load()}
        />
      ) : null}
      {kind === 'ready' && quota ? (
        <>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label={t('quota.h_1h6b62d')}>
              {quota.allocated}
            </Descriptions.Item>
            <Descriptions.Item label="Capacity">
              {quota.capacity === null ? t('quota.h_1tnoz3k') : quota.capacity}
            </Descriptions.Item>
          </Descriptions>
          {percent !== undefined ? (
            <Progress percent={percent} status="active" />
          ) : (
            <Alert
              type="info"
              showIcon
              message={t('quota.capacityUnlimited')}
            />
          )}
        </>
      ) : null}
    </Space>
  );
}
