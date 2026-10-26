'use client';

import { Alert, Button, Flex, Result, Spin } from 'antd';
import { PortalPage } from '../../../../../../src/components/portal-page';
import { useParams } from 'next/navigation';
import { CsPanel } from '../../../../../../src/ops/panels/cs-panel';
import { isEventPagePermitted } from '../../../../../../src/prep/event-access-resolver';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { canPerformEventAction } from '../../../../../../src/nav/capability-policy';
import { usePortalLocale } from '../../../../../../src/i18n';
import { SURFACE_MESSAGE_KEYS } from '../../../../../../src/prep/surface-copy';

export default function EventSupportPage() {
  const { t } = usePortalLocale();
  const params = useParams<{ tenantId: string; eventId: string }>();
  const { tenantId, eventId } = params;
  const access = useEventAccess(tenantId, eventId);

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
        subTitle={t('support.h_14ecmxf')}
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
  if (!isEventPagePermitted('support', access.permissions)) {
    return (
      <Result
        status="403"
        title={t(SURFACE_MESSAGE_KEYS.permissionTitle)}
        subTitle={t('support.h_14ecmxf')}
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

  const canCs = canPerformEventAction('lookupSupport', access.permissions);

  return (
    <PortalPage title={t('nav.event.support')}>
      <CsPanel tenantId={tenantId} eventId={eventId} canCs={canCs} />
    </PortalPage>
  );
}
