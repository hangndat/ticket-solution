'use client';

import { Card, Descriptions, Typography } from 'antd';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { MeEventItem } from '@ticket/contracts';
import { gateDeeplinkUrl } from '../../../../../src/oidc/config';
import { loadShellContext } from '../../../../../src/nav/load-shell-context';
import {
  GateDeeplinkButton,
  GateStayAppNotice,
} from '../../../../../src/components/gate-deeplink';
import { SurfaceState } from '../../../../../src/components/surface-state';

export default function EventOverviewPage() {
  const params = useParams<{ tenantId: string; eventId: string }>();
  const [kind, setKind] = useState<
    'loading' | 'ready' | 'permission-denied' | 'error'
  >('loading');
  const [event, setEvent] = useState<MeEventItem | null>(null);
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    void loadShellContext().then((shell) => {
      if (shell.status === 'unauthenticated') {
        window.location.href = `/api/auth/login?return=/t/${params.tenantId}/e/${params.eventId}`;
        return;
      }
      if (shell.status === 'error') {
        setKind('error');
        setMessage(shell.message);
        return;
      }
      if (shell.status !== 'ready') return;
      const found =
        shell.meEvents?.items.find(
          (e) =>
            e.tenantId === params.tenantId && e.eventId === params.eventId,
        ) ?? null;
      if (!found) {
        setKind('permission-denied');
        return;
      }
      setEvent(found);
      setKind('ready');
    });
  }, [params.tenantId, params.eventId]);

  if (kind === 'loading') return <SurfaceState kind="loading" />;
  if (kind === 'error') {
    return (
      <SurfaceState
        kind="error"
        description={message}
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (kind === 'permission-denied' || !event) {
    return (
      <SurfaceState
        kind="permission-denied"
        description="Sự kiện không nằm trong khám phá máy chủ của bạn."
        onRetry={() => {
          window.location.href = `/t/${params.tenantId}`;
        }}
      />
    );
  }

  const canReport = event.permissions.includes('report.read');
  const canScan = event.permissions.includes('gate.confirm');

  return (
    <Card>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        {event.name}
      </Typography.Title>
      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="eventId">{event.eventId}</Descriptions.Item>
        <Descriptions.Item label="Quyền (server)">
          {event.permissions.join(', ') || '—'}
        </Descriptions.Item>
      </Descriptions>

      {canScan ? (
        <div style={{ marginTop: 24 }}>
          <GateStayAppNotice />
          <div style={{ marginTop: 12 }}>
            <GateDeeplinkButton href={gateDeeplinkUrl()} />
          </div>
        </div>
      ) : null}

      {canReport ? (
        <Typography.Paragraph style={{ marginTop: 24 }}>
          Báo cáo cổng (report.read) sẽ mở tại route Cổng — không gắn camera quét
          trên portal.
        </Typography.Paragraph>
      ) : null}
    </Card>
  );
}
