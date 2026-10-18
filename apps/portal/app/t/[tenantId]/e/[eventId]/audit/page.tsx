'use client';

import { Alert, Space, Tabs, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AuditPanel } from '../../../../../../src/ops/panels/audit-panel';
import { CodesPanel } from '../../../../../../src/ops/panels/codes-panel';
import { ExportPanel } from '../../../../../../src/ops/panels/export-panel';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { SurfaceState } from '../../../../../../src/components/surface-state';

export default function EventAuditPage() {
  const params = useParams<{ tenantId: string; eventId: string }>();
  const { tenantId, eventId } = params;
  const access = useEventAccess(tenantId, eventId);
  const [activeTab, setActiveTab] = useState('audit');

  const permissions = useMemo(
    () => (access.kind === 'ready' ? access.permissions : []),
    [access],
  );
  const canAudit = permissions.includes('report.read');
  const canCodes = permissions.includes('inventory.import');
  const canJobs = canAudit || canCodes;

  useEffect(() => {
    queueMicrotask(() => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'codes' || hash === 'jobs' || hash === 'audit') {
        setActiveTab(hash);
      }
    });
  }, []);

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
  if (access.kind === 'permission-denied' || !canJobs) {
    return (
      <SurfaceState
        kind="permission-denied"
        description="Cần report.read (nhật ký/export) hoặc inventory.import (mã tồn kho) từ máy chủ — không suy từ tên role."
        onRetry={() => {
          window.location.href = `/t/${tenantId}/e/${eventId}`;
        }}
      />
    );
  }

  const tabItems: { key: string; label: string; children: ReactNode }[] = [];
  if (canAudit) {
    tabItems.push({
      key: 'audit',
      label: 'Nhật ký',
      children: <AuditPanel tenantId={tenantId} eventId={eventId} />,
    });
  }
  if (canCodes) {
    tabItems.push({
      key: 'codes',
      label: 'Mã tồn kho',
      children: <CodesPanel tenantId={tenantId} eventId={eventId} />,
    });
  }
  if (canAudit) {
    tabItems.push({
      key: 'jobs',
      label: 'Lịch sử export',
      children: <ExportPanel tenantId={tenantId} eventId={eventId} />,
    });
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        Nhật ký & mã
      </Typography.Title>
      <Alert
        type="info"
        showIcon
        message="P1.1 audit browser + job history"
        description="Audit = report.read. Codes = inventory.import (masked). Export history không chứa object key / URL ký sẵn. Platform audit nằm ở /platform (Operator riêng)."
      />
      <Tabs
        activeKey={
          tabItems.some((t) => t.key === activeTab)
            ? activeTab
            : tabItems[0]?.key
        }
        onChange={(key) => {
          setActiveTab(key);
          window.location.hash = key;
        }}
        items={tabItems}
      />
    </Space>
  );
}
