'use client';

import { Button, Card, List, Typography } from 'antd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTenantAccess } from '../../../src/prep/use-event-access';
import { SurfaceState } from '../../../src/components/surface-state';

export default function TenantOverviewPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const access = useTenantAccess(tenantId);

  if (access.kind === 'loading') return <SurfaceState kind="loading" />;
  if (access.kind === 'error') {
    return (
      <SurfaceState
        kind="error"
        description={access.message}
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (access.kind === 'permission-denied') {
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

  const { tenant, events } = access;
  const canCreate = tenant.tenantPermissions.includes('event.create');
  const canList = tenant.tenantPermissions.includes('event.list');

  return (
    <Card>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        {tenant.name}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {tenant.slug} · vai trò {tenant.role} · trạng thái {tenant.status}
      </Typography.Paragraph>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        {canList ? (
          <Link href={`/t/${tenantId}/events`}>
            <Button>Tất cả sự kiện</Button>
          </Link>
        ) : null}
        {canCreate ? (
          <Link href={`/t/${tenantId}/events/new`}>
            <Button type="primary">Tạo sự kiện</Button>
          </Link>
        ) : null}
        {tenant.tenantPermissions.includes('members.manage') ? (
          <Link href={`/t/${tenantId}/members`}>
            <Button>Thành viên</Button>
          </Link>
        ) : null}
      </div>

      {events.length === 0 ? (
        <SurfaceState
          kind="empty"
          description="Chưa có sự kiện được gán trong khám phá."
          emptyAction={
            canCreate ? (
              <Link href={`/t/${tenantId}/events/new`}>
                <Button type="primary">Tạo sự kiện</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <List
          header={<Typography.Text strong>Sự kiện (MeEvents)</Typography.Text>}
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
              <List.Item.Meta
                title={item.name}
                description={`${item.permissions.length} quyền server`}
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
