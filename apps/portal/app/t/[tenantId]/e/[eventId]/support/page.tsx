'use client';

import { PortalPage } from '../../../../../../src/components/portal-page';
import { useParams } from 'next/navigation';
import { CsPanel } from '../../../../../../src/ops/panels/cs-panel';
import { isEventPagePermitted } from '../../../../../../src/prep/event-access-resolver';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { SurfaceState } from '../../../../../../src/components/surface-state';
import { usePortalLocale } from '../../../../../../src/i18n';

export default function EventSupportPage() {
  const { t } = usePortalLocale();
  const params = useParams<{ tenantId: string; eventId: string }>();
  const { tenantId, eventId } = params;
  const access = useEventAccess(tenantId, eventId);

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
        description={t('support.h_14ecmxf')}
        onRetry={() => {
          window.location.href = `/t/${tenantId}`;
        }}
      />
    );
  }
  if (!isEventPagePermitted('support', access.permissions)) {
    return (
      <SurfaceState
        kind="permission-denied"
        description={t('support.h_14ecmxf')}
        onRetry={() => {
          window.location.href = `/t/${tenantId}/e/${eventId}`;
        }}
      />
    );
  }

  const canCs = access.permissions.includes('cs.lookup');

  return (
    <PortalPage title={t('nav.event.support')}>
      <CsPanel tenantId={tenantId} eventId={eventId} canCs={canCs} />
    </PortalPage>
  );
}
