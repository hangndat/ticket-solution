'use client';

import { Button, Card, List, Typography } from 'antd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTenantAccess } from '../../../src/prep/use-event-access';
import { SurfaceState } from '../../../src/components/surface-state';
import { usePortalLocale } from '../../../src/i18n';
import { isPendingActivationStatus } from '../../../src/onboarding';

export default function TenantOverviewPage() {
  const { t } = usePortalLocale();
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const access = useTenantAccess(tenantId);

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
        description={t('common.h_yw94nu')}
        onRetry={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  const { tenant, events } = access;

  // PENDING: no admin chrome mutations — send Owner to wait Result (AC-PS5).
  if (isPendingActivationStatus(tenant.status)) {
    return (
      <SurfaceState
        kind="pending-activation"
        title={t('onboarding.pending.title')}
        description={t('onboarding.pending.body', {
          name: tenant.name,
          slug: tenant.slug,
        })}
        emptyAction={
          <Link href={`/onboarding/${tenantId}`}>
            <Button type="primary">{t('onboarding.pending.openWait')}</Button>
          </Link>
        }
      />
    );
  }

  const canCreate = tenant.tenantPermissions.includes('event.create');
  const canList = tenant.tenantPermissions.includes('event.list');

  return (
    <Card>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        {tenant.name}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {t('tenant.home.meta', { slug: tenant.slug, role: tenant.role, status: tenant.status })}
      </Typography.Paragraph>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        {canList ? (
          <Link href={`/t/${tenantId}/events`}>
            <Button>{t('common.h_8mpr7p')}</Button>
          </Link>
        ) : null}
        {canCreate ? (
          <Link href={`/t/${tenantId}/events/new`}>
            <Button type="primary">{t('events.h_ek93o2')}</Button>
          </Link>
        ) : null}
        {tenant.tenantPermissions.includes('members.manage') ? (
          <Link href={`/t/${tenantId}/members`}>
            <Button>{t('nav.org.members')}</Button>
          </Link>
        ) : null}
      </div>

      {events.length === 0 ? (
        <SurfaceState
          kind="empty"
          description={t('common.h_1bzxqwd')}
          emptyAction={
            canCreate ? (
              <Link href={`/t/${tenantId}/events/new`}>
                <Button type="primary">{t('events.h_ek93o2')}</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <List
          header={<Typography.Text strong>{t('common.h_6izk0k')}</Typography.Text>}
          dataSource={events}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Link
                  key="open"
                  href={`/t/${item.tenantId}/e/${item.eventId}`}
                >{t('common.mo')}</Link>,
              ]}
            >
              <List.Item.Meta
                title={item.name}
                description={t('common.serverPermissions', { count: item.permissions.length })}
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
