'use client';

import { Space, Typography } from 'antd';
import { useParams } from 'next/navigation';
import { CsPanel } from '../../../../../../src/ops/panels/cs-panel';
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

  const canCs = access.permissions.includes('cs.lookup');

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        {t('nav.event.support')}
      </Typography.Title>
      <CsPanel tenantId={tenantId} eventId={eventId} canCs={canCs} />
    </Space>
  );
}
