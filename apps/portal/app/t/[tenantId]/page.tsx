'use client';

import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  List,
  Result,
  Space,
  Spin,
  Statistic,
  Typography,
} from 'antd';
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

  if (access.kind === 'loading') {
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
          <Button
            type="primary"
            onClick={() => {
              window.location.href = '/';
            }}
          >
            {t(SURFACE_MESSAGE_KEYS.permissionGoAllowed)}
          </Button>
        }
      />
    );
  }

  const { tenant, events } = access;

  if (isPendingActivationStatus(tenant.status)) {
    return (
      <Result
        status="info"
        title={t('onboarding.pending.title')}
        subTitle={t('onboarding.pending.body', {
          name: tenant.name,
          slug: tenant.slug,
        })}
        extra={
          <Link href={`/onboarding/${tenantId}`}>
            <Button type="primary">{t('onboarding.pending.openWait')}</Button>
          </Link>
        }
      />
    );
  }

  const canCreate = canPerformTenantAction(
    'createEvent',
    tenant.tenantPermissions,
  );
  const canList = canPerformTenantAction('listEvents', tenant.tenantPermissions);

  const metaLine = t('tenant.home.meta', {
    slug: tenant.slug,
    role: formatTenantRole(locale, tenant.role),
    status: formatTenantStatus(locale, tenant.status),
  });

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap="middle">
        <div>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
            {tenant.name}
          </Typography.Title>
          <Typography.Text type="secondary">{metaLine}</Typography.Text>
        </div>
        <Space wrap>
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
        </Space>
      </Flex>

      <Card size="small">
        <Statistic title={t('nav.org.events')} value={events.length} />
      </Card>

      {events.length === 0 ? (
        <Empty description={t('common.h_1bzxqwd')} style={{ padding: 48 }}>
          {canCreate ? (
            <Link href={`/t/${tenantId}/events/new`}>
              <Button type="primary">{t('events.h_ek93o2')}</Button>
            </Link>
          ) : undefined}
        </Empty>
      ) : (
        <List
          header={
            <Typography.Text strong>{t('common.h_6izk0k')}</Typography.Text>
          }
          dataSource={events}
          renderItem={(row) => {
            const openPath = firstAllowedEventPath(row);
            return (
              <List.Item
                actions={
                  openPath
                    ? [
                        <Link key="open" href={openPath}>
                          {t('common.mo')}
                        </Link>,
                      ]
                    : undefined
                }
              >
                <List.Item.Meta
                  title={row.name}
                  description={t('common.eventPermissions', {
                    count: row.permissions.length,
                  })}
                />
              </List.Item>
            );
          }}
        />
      )}
    </Space>
  );
}
