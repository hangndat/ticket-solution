'use client';

import { Button, Card, List, Typography } from 'antd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { MeEventItem, MeTenantItem } from '@ticket/contracts';
import { loadShellContext } from '../../../src/nav/load-shell-context';
import { tenantHasAdminChrome } from '../../../src/nav/capabilities';
import { SurfaceState } from '../../../src/components/surface-state';

export default function TenantOverviewPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const [kind, setKind] = useState<
    'loading' | 'ready' | 'empty' | 'error' | 'permission-denied'
  >('loading');
  const [tenant, setTenant] = useState<MeTenantItem | null>(null);
  const [events, setEvents] = useState<MeEventItem[]>([]);
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    void loadShellContext().then((shell) => {
      if (cancelled) return;
      if (shell.status === 'unauthenticated') {
        window.location.href = `/api/auth/login?return=/t/${tenantId}`;
        return;
      }
      if (shell.status === 'error') {
        setKind('error');
        setMessage(shell.message);
        return;
      }
      if (shell.status !== 'ready') return;

      const found =
        shell.meTenants?.items.find((t) => t.tenantId === tenantId) ?? null;
      if (!found || !tenantHasAdminChrome(found)) {
        setKind('permission-denied');
        return;
      }
      const tenantEvents =
        shell.meEvents?.items.filter((e) => e.tenantId === tenantId) ?? [];
      setTenant(found);
      setEvents(tenantEvents);
      setKind(tenantEvents.length === 0 ? 'empty' : 'ready');
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

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
      <SurfaceState
        kind="permission-denied"
        description="Tổ chức không tồn tại trong khám phá của bạn hoặc thiếu quyền quản trị."
        onRetry={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  return (
    <Card>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        {tenant?.name}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {tenant?.slug} · vai trò {tenant?.role} · trạng thái {tenant?.status}
      </Typography.Paragraph>

      {kind === 'empty' ? (
        <SurfaceState
          kind="empty"
          description="Chưa có sự kiện được gán."
          emptyAction={
            tenant?.tenantPermissions.includes('event.create') ? (
              <Button type="primary" disabled>
                Tạo sự kiện (sóng tiếp)
              </Button>
            ) : undefined
          }
        />
      ) : (
        <List
          header={<Typography.Text strong>Sự kiện</Typography.Text>}
          dataSource={events}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Link
                  key="open"
                  href={`/t/${item.tenantId}/e/${item.eventId}`}
                >
                  Mở
                </Link>,
              ]}
            >
              <List.Item.Meta title={item.name} description={item.eventId} />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
