'use client';

import { ProList, StatisticCard } from '@ant-design/pro-components';
import { Button } from 'antd';
import { PortalPage } from '../../../src/components/portal-page';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTenantAccess } from '../../../src/prep/use-event-access';
import { SurfaceState } from '../../../src/components/surface-state';
import {
  formatTenantRole,
  formatTenantStatus,
  usePortalLocale,
} from '../../../src/i18n';
import { isPendingActivationStatus } from '../../../src/onboarding';

export default function TenantOverviewPage() {
  const { t, locale } = usePortalLocale();
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
    <PortalPage
      title={tenant.name}
      subTitle={t('tenant.home.meta', {
        slug: tenant.slug,
        role: formatTenantRole(locale, tenant.role),
        status: formatTenantStatus(locale, tenant.status),
      })}
      extra={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
      }
    >
      <StatisticCard.Group style={{ marginBottom: 16 }}>
        <StatisticCard statistic={{ title: t('nav.org.events'), value: events.length }} />
      </StatisticCard.Group>

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
        <ProList
          headerTitle={t('common.h_6izk0k')}
          dataSource={events}
          metas={{
            title: { dataIndex: 'name' },
            description: {
              render: (_, row) =>
                t('common.eventPermissions', { count: row.permissions.length }),
            },
            actions: {
              render: (_, row) => [
                <Link key="open" href={`/t/${row.tenantId}/e/${row.eventId}`}>
                  {t('common.mo')}
                </Link>,
              ],
            },
          }}
        />
      )}
    </PortalPage>
  );
}
