'use client';

import { ProList, StatisticCard } from '@ant-design/pro-components';
import { Alert, Button, Empty, Flex, Result, Spin } from 'antd';
import { PortalPage } from '../../../src/components/portal-page';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTenantAccess } from '../../../src/prep/use-event-access';
import {
  canPerformTenantAction,
  firstAllowedEventPath,
} from '../../../src/nav/capability-policy';
import {
  formatTenantRole,
  formatTenantStatus,
  usePortalLocale,
} from '../../../src/i18n';
import { SURFACE_MESSAGE_KEYS } from '../../../src/prep/surface-copy';
import { isPendingActivationStatus } from '../../../src/onboarding';

export default function TenantOverviewPage() {
  const { t, locale } = usePortalLocale();
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const access = useTenantAccess(tenantId);

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
        subTitle={t('common.h_yw94nu')}
        extra={
          <Button type="primary" onClick={() => {
          window.location.href = '/';
        }}>
            {t(SURFACE_MESSAGE_KEYS.permissionGoAllowed)}
          </Button>
        }
      />
    );
  }

  const { tenant, events } = access;

  // PENDING: no admin chrome mutations — send Owner to wait Result (AC-PS5).
  if (isPendingActivationStatus(tenant.status)) {
    return (
      <Result status="info" title={t('onboarding.pending.title')} subTitle={t('onboarding.pending.body', {
          name: tenant.name,
          slug: tenant.slug,
        })} extra={<Link href={`/onboarding/${tenantId}`}>
            <Button type="primary">{t('onboarding.pending.openWait')}</Button>
          </Link>} />
    );
  }

  const canCreate = canPerformTenantAction(
    'createEvent',
    tenant.tenantPermissions,
  );
  const canList = canPerformTenantAction(
    'listEvents',
    tenant.tenantPermissions,
  );

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
          {canPerformTenantAction('manageMembers', tenant.tenantPermissions) ? (
            <Link href={`/t/${tenantId}/members`}>
              <Button>{t('nav.org.members')}</Button>
            </Link>
          ) : null}
        </div>
      }
    >
      <StatisticCard.Group style={{ marginBottom: 16 }}>
        <StatisticCard
          statistic={{ title: t('nav.org.events'), value: events.length }}
        />
      </StatisticCard.Group>

      {events.length === 0 ? (
        <Empty description={t('common.h_1bzxqwd')} style={{ padding: 48 }}>
          {
            canCreate ? (
              <Link href={`/t/${tenantId}/events/new`}>
                <Button type="primary">{t('events.h_ek93o2')}</Button>
              </Link>
            ) : undefined
          }
        </Empty>
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
                firstAllowedEventPath(row) ? (
                  <Link key="open" href={firstAllowedEventPath(row)!}>
                    {t('common.mo')}
                  </Link>
                ) : null,
              ],
            },
          }}
        />
      )}
    </PortalPage>
  );
}
