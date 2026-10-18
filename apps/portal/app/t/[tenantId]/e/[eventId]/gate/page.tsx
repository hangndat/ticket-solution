'use client';

import { Card, Result, Typography } from 'antd';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { gateDeeplinkUrl } from '../../../../../../src/oidc/config';
import { loadShellContext } from '../../../../../../src/nav/load-shell-context';
import {
  GateDeeplinkButton,
  GateStayAppNotice,
} from '../../../../../../src/components/gate-deeplink';
import { SurfaceState } from '../../../../../../src/components/surface-state';

/**
 * GATE-STAY-APP: report surface only — never mount scanner on portal.
 */
export default function EventGateReportPage() {
  const params = useParams<{ tenantId: string; eventId: string }>();
  const [kind, setKind] = useState<
    'loading' | 'ready' | 'permission-denied' | 'error'
  >('loading');
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    void loadShellContext().then((shell) => {
      if (shell.status === 'unauthenticated') {
        window.location.href = `/api/auth/login?return=/t/${params.tenantId}/e/${params.eventId}/gate`;
        return;
      }
      if (shell.status === 'error') {
        setKind('error');
        setMessage(shell.message);
        return;
      }
      if (shell.status !== 'ready') return;
      const found = shell.meEvents?.items.find(
        (e) =>
          e.tenantId === params.tenantId && e.eventId === params.eventId,
      );
      if (!found || !found.permissions.includes('report.read')) {
        setKind('permission-denied');
        return;
      }
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
  if (kind === 'permission-denied') {
    return (
      <Result
        status="403"
        title="Không có quyền báo cáo cổng"
        subTitle="Cần report.read từ máy chủ — không suy từ gate.confirm / Scanner."
      />
    );
  }

  return (
    <Card>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        Cổng — báo cáo
      </Typography.Title>
      <GateStayAppNotice />
      <Typography.Paragraph style={{ marginTop: 16 }}>
        Bảng số liệu report gắn API sẵn có sẽ nối ở sóng tiếp. Quét vé chỉ trên
        app.
      </Typography.Paragraph>
      <GateDeeplinkButton
        href={gateDeeplinkUrl(process.env, '/gate', {
          tenantId: params.tenantId,
          eventId: params.eventId,
        })}
      />
    </Card>
  );
}
