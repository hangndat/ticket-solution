'use client';

import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  Result,
  Space,
  Table,
  Tabs,
  Typography,
} from 'antd';
import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  PortalPlatformAuditEntry,
  PortalPlatformTenantHealth,
  PortalPlatformTenantSummary,
} from '@ticket/contracts';
import { loadShellContext } from '../../src/nav/load-shell-context';
import { SurfaceState } from '../../src/components/surface-state';
import { portalGet, portalMutate } from '../../src/client/portal-fetch';
import {
  bffPlatformAudit,
  bffPlatformSupportGrantRevoke,
  bffPlatformTenantHealth,
  bffPlatformTenants,
} from '../../src/prep/bff-urls';
import {
  buildAuditQuery,
  interpretPlatformAuditPage,
  type PlatformAuditListView,
} from '../../src/ops/audit';
import {
  buildPlatformListQuery,
  interpretPlatformTenantHealth,
  interpretPlatformTenantsPage,
  interpretSupportGrantRevoke,
  type PlatformHealthView,
  type PlatformRevokeView,
  type PlatformTenantsView,
} from '../../src/ops/platform-zone';
import { usePortalLocale, type MessageKey } from '../../src/i18n';

function PlatformInner() {
  const { t, locale } = usePortalLocale();
  const params = useSearchParams();
  const error = params.get('error');
  const [kind, setKind] = useState<
    'loading' | 'ready' | 'denied' | 'error' | 'unsigned'
  >('loading');
  const [assurance, setAssurance] = useState<string | null>(null);
  const [messageKey, setMessageKey] = useState<MessageKey | undefined>();

  const [tenantsBusy, setTenantsBusy] = useState(false);
  const [tenantsView, setTenantsView] = useState<PlatformTenantsView | null>(
    null,
  );
  const [tenants, setTenants] = useState<PortalPlatformTenantSummary[]>([]);
  const [tenantsCursor, setTenantsCursor] = useState<string | null>(null);

  const [auditBusy, setAuditBusy] = useState(false);
  const [auditView, setAuditView] = useState<PlatformAuditListView | null>(
    null,
  );
  const [auditItems, setAuditItems] = useState<PortalPlatformAuditEntry[]>([]);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [filterTenantId, setFilterTenantId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [healthBusy, setHealthBusy] = useState(false);
  const [healthTenantId, setHealthTenantId] = useState('');
  const [healthView, setHealthView] = useState<PlatformHealthView | null>(
    null,
  );
  const [health, setHealth] = useState<PortalPlatformTenantHealth | null>(
    null,
  );

  const [revokeBusy, setRevokeBusy] = useState(false);
  const [revokeGrantId, setRevokeGrantId] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeView, setRevokeView] = useState<PlatformRevokeView | null>(
    null,
  );

  useEffect(() => {
    void loadShellContext().then((shell) => {
      if (shell.status === 'error') {
        setKind('error');
        setMessageKey(shell.messageKey);
        return;
      }
      if (shell.status !== 'ready') {
        setKind('unsigned');
        return;
      }
      if (!shell.platformMe?.operator) {
        setKind('denied');
        return;
      }
      setAssurance(shell.platformMe.assurance);
      setKind('ready');
    });
  }, []);

  const loadTenants = useCallback(
    async (cursor?: string | null, append = false) => {
      setTenantsBusy(true);
      const qs = buildPlatformListQuery({ cursor, limit: 20 });
      const res = await portalGet(`${bffPlatformTenants()}${qs}`);
      const next = interpretPlatformTenantsPage(
        res.status,
        res.json,
        res.networkError || res.timedOut, locale,
      );
      setTenantsView(next);
      if (next.kind === 'page') {
        setTenants((prev) =>
          append ? [...prev, ...next.page.items] : next.page.items,
        );
        setTenantsCursor(next.page.nextCursor);
      } else if (!append) {
        setTenants([]);
        setTenantsCursor(null);
      }
      setTenantsBusy(false);
    },
    [locale],
  );

  const loadAudit = useCallback(
    async (cursor?: string | null, append = false) => {
      setAuditBusy(true);
      const qs = buildAuditQuery({
        cursor,
        limit: 20,
        from: from.trim() || undefined,
        to: to.trim() || undefined,
        action: action.trim() || undefined,
        tenantId: filterTenantId.trim() || undefined,
      });
      const res = await portalGet(`${bffPlatformAudit()}${qs}`);
      const next = interpretPlatformAuditPage(
        res.status,
        res.json,
        res.networkError || res.timedOut, locale,
      );
      setAuditView(next);
      if (next.kind === 'page') {
        setAuditItems((prev) =>
          append ? [...prev, ...next.page.items] : next.page.items,
        );
        setAuditCursor(next.page.nextCursor);
      } else if (!append) {
        setAuditItems([]);
        setAuditCursor(null);
      }
      setAuditBusy(false);
    },
    [action, filterTenantId, from, to, locale],
  );

  const loadHealth = useCallback(async (tenantId: string) => {
    const id = tenantId.trim();
    setHealthTenantId(id);
    setHealthBusy(true);
    setHealth(null);
    if (!id) {
      setHealthView({
        kind: 'rejected',
        code: 'INVALID_INPUT',
        message: t('platform.pickTenant'),
      });
      setHealthBusy(false);
      return;
    }
    const res = await portalGet(bffPlatformTenantHealth(id));
    const next = interpretPlatformTenantHealth(
      res.status,
      res.json,
      res.networkError || res.timedOut, locale,
    );
    setHealthView(next);
    setHealth(next.kind === 'ok' ? next.health : null);
    setHealthBusy(false);
  }, [locale, t]);

  const submitRevoke = useCallback(async () => {
    const grantId = revokeGrantId.trim();
    const reason = revokeReason.trim();
    setRevokeBusy(true);
    setRevokeView(null);
    if (!grantId || !reason) {
      setRevokeView({
        kind: 'rejected',
        code: 'INVALID_INPUT',
        message: t('platform.h_1bkeue4'),
      });
      setRevokeBusy(false);
      return;
    }
    const res = await portalMutate(bffPlatformSupportGrantRevoke(grantId), {
      reason,
    });
    const next = interpretSupportGrantRevoke(
      res.status,
      res.json,
      res.networkError || res.timedOut, locale,
    );
    setRevokeView(next);
    setRevokeBusy(false);
  }, [revokeGrantId, revokeReason, locale, t]);

  useEffect(() => {
    if (kind !== 'ready') return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void loadTenants(null, false);
      void loadAudit(null, false);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, loadTenants, loadAudit]);

  if (error) {
    return (
      <Result
        status="error"
        title={t('platform.h_1rlo1g2')}
        subTitle={error}
        extra={
          <Button type="primary" href="/api/auth/platform/login">{t('platform.h_hcpyf4')}</Button>
        }
      />
    );
  }

  if (kind === 'loading') return <SurfaceState kind="loading" />;
  if (kind === 'error') {
    return (
      <SurfaceState
        kind="unknown"
        description={messageKey ? t(messageKey) : undefined}
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (kind === 'unsigned') {
    return (
      <Card>
        <Typography.Title level={3}>{t('platform.h_3nfdgm')}</Typography.Title>
        <Typography.Paragraph>{t('platform.h_9c63t5')}</Typography.Paragraph>
        <Button type="primary" href="/api/auth/platform/login">{t('platform.h_1sfcojp')}</Button>
      </Card>
    );
  }
  if (kind === 'denied') {
    return (
      <SurfaceState
        kind="permission-denied"
        title={t('platform.h_1xkaqi6')}
        description={t('platform.h_rvf1a3')}
        onRetry={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space
        style={{ width: '100%', justifyContent: 'space-between' }}
        wrap
      >
        <Typography.Title level={3} style={{ margin: 0 }}>
          Platform
        </Typography.Title>
        <Button danger href="/api/auth/platform/logout">{t('account.h_21w6fq')}</Button>
      </Space>
      <Alert
        type="info"
        showIcon
        message={t('platform.zoneLabel', { assurance })}
        description={t('platform.h_ed3cdu')}
      />
      <Tabs
        items={[
          {
            key: 'tenants',
            label: 'Tenants',
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {tenantsView?.kind === 'rejected' ||
                tenantsView?.kind === 'unknown' ? (
                  <Alert
                    type="warning"
                    showIcon
                    message={tenantsView.message}
                    data-testid="platform-tenants-status"
                  />
                ) : null}
                <Table
                  size="small"
                  rowKey="tenantId"
                  loading={tenantsBusy}
                  dataSource={tenants}
                  pagination={false}
                  data-testid="platform-tenants-table"
                  locale={{ emptyText: t('platform.h_1vlqd43') }}
                  columns={[
                    { title: 'Slug', dataIndex: 'slug', width: 140 },
                    { title: 'Name', dataIndex: 'name', ellipsis: true },
                    { title: 'Status', dataIndex: 'status', width: 120 },
                    { title: 'Version', dataIndex: 'version', width: 90 },
                    {
                      title: 'Created',
                      dataIndex: 'createdAt',
                      ellipsis: true,
                    },
                    {
                      title: '',
                      key: 'actions',
                      width: 200,
                      render: (_, row) => (
                        <Space size="small">
                          <Button
                            size="small"
                            onClick={() => setFilterTenantId(row.tenantId)}
                          >{t('platform.h_1sthjos')}</Button>
                          <Button
                            size="small"
                            type="primary"
                            loading={
                              healthBusy && healthTenantId === row.tenantId
                            }
                            onClick={() => void loadHealth(row.tenantId)}
                            data-testid={`platform-health-btn-${row.tenantId}`}
                          >
                            Health
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
                {tenantsCursor ? (
                  <Button
                    loading={tenantsBusy}
                    onClick={() => void loadTenants(tenantsCursor, true)}
                  >{t('platform.h_4cj11z')}</Button>
                ) : null}
              </Space>
            ),
          },
          {
            key: 'health',
            label: 'Tenant health',
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Alert
                  type="info"
                  showIcon
                  message="H-P2"
                  description={t('platform.health.hint')}
                />
                <Space wrap>
                  <Input
                    placeholder={t('platform.h_ggf21i')}
                    value={healthTenantId}
                    onChange={(e) => setHealthTenantId(e.target.value)}
                    style={{ minWidth: 320 }}
                    spellCheck={false}
                    allowClear
                    data-testid="platform-health-tenant-input"
                  />
                  <Button
                    type="primary"
                    loading={healthBusy}
                    onClick={() => void loadHealth(healthTenantId)}
                    data-testid="platform-health-load"
                  >
                    {t('platform.readHealth')}
                  </Button>
                </Space>
                {healthView?.kind === 'rejected' ||
                healthView?.kind === 'unknown' ? (
                  <Alert
                    type="warning"
                    showIcon
                    message={healthView.message}
                    data-testid="platform-health-status"
                  />
                ) : null}
                {health ? (
                  <Card size="small" data-testid="platform-health">
                    <Descriptions
                      size="small"
                      column={1}
                      title="Counters (sanitize)"
                      items={[
                        {
                          key: 'ids',
                          label: 'tenant / observedAt',
                          children: `${health.tenantId} · ${health.observedAt}`,
                        },
                        {
                          key: 'notif',
                          label: 'notifications',
                          children: `pending=${health.notifications.pending} · failed=${health.notifications.failed} · dead=${health.notifications.dead}`,
                        },
                        {
                          key: 'outbox',
                          label: 'outbox',
                          children: `pending=${health.outbox.pending} · failed=${health.outbox.failed}`,
                        },
                        {
                          key: 'usage',
                          label: 'usage',
                          children: `events=${health.usage.events} · staffActive=${health.usage.staffActive} · staffPendingInvites=${health.usage.staffPendingInvites} · emailToday=${health.usage.emailToday}`,
                        },
                      ]}
                    />
                  </Card>
                ) : null}
              </Space>
            ),
          },
          {
            key: 'revoke',
            label: t('platform.h_19s5r5m'),
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Alert
                  type="warning"
                  showIcon
                  message={t('platform.h_1541rk1')}
                  description={t('platform.revokeGrantHint')}
                />
                <Input
                  placeholder={t('platform.h_1ke65pq')}
                  value={revokeGrantId}
                  onChange={(e) => setRevokeGrantId(e.target.value)}
                  spellCheck={false}
                  allowClear
                  data-testid="platform-revoke-grant-input"
                />
                <Input.TextArea
                  placeholder={t('platform.h_1jyd8b')}
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  showCount
                  data-testid="platform-revoke-reason-input"
                />
                <Button
                  danger
                  type="primary"
                  loading={revokeBusy}
                  onClick={() => void submitRevoke()}
                  data-testid="platform-revoke-submit"
                >{t('platform.h_11v4ibm')}</Button>
                {revokeView?.kind === 'ok' ? (
                  <Alert
                    type="success"
                    showIcon
                    message={t('ops.notifications.revokeGrantDone', { grantId: revokeView.result.grantId })}
                    description={`revokedAt=${revokeView.result.revokedAt}`}
                    data-testid="platform-revoke-status"
                  />
                ) : null}
                {revokeView?.kind === 'rejected' ||
                revokeView?.kind === 'unknown' ? (
                  <Alert
                    type="error"
                    showIcon
                    message={revokeView.message}
                    data-testid="platform-revoke-status"
                  />
                ) : null}
              </Space>
            ),
          },
          {
            key: 'audit',
            label: 'Platform audit',
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Alert
                  type="info"
                  showIcon
                  message="H-P-AUDIT"
                  description={t('platform.h_qo8t9w')}
                />
                <Space wrap>
                  <Input
                    placeholder="action"
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    style={{ minWidth: 160 }}
                    allowClear
                  />
                  <Input
                    placeholder="tenantId filter"
                    value={filterTenantId}
                    onChange={(e) => setFilterTenantId(e.target.value)}
                    style={{ minWidth: 280 }}
                    spellCheck={false}
                    allowClear
                  />
                  <Input
                    placeholder="from ISO (…Z)"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    style={{ minWidth: 200 }}
                    spellCheck={false}
                  />
                  <Input
                    placeholder="to ISO (…Z)"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    style={{ minWidth: 200 }}
                    spellCheck={false}
                  />
                  <Button
                    type="primary"
                    loading={auditBusy}
                    onClick={() => void loadAudit(null, false)}
                  >{t('platform.loc')}</Button>
                </Space>
                {auditView?.kind === 'rejected' ||
                auditView?.kind === 'unknown' ? (
                  <Alert
                    type="warning"
                    showIcon
                    message={auditView.message}
                    data-testid="platform-audit-status"
                  />
                ) : null}
                <Table
                  size="small"
                  rowKey="auditId"
                  loading={auditBusy}
                  dataSource={auditItems}
                  pagination={false}
                  data-testid="platform-audit-table"
                  locale={{ emptyText: t('platform.h_5wjoae') }}
                  columns={[
                    {
                      title: t('platform.h_zdynbv'),
                      dataIndex: 'createdAt',
                      width: 200,
                      ellipsis: true,
                    },
                    { title: 'Action', dataIndex: 'action', width: 140 },
                    { title: 'Tenant', dataIndex: 'tenantId', ellipsis: true },
                    { title: 'Actor', dataIndex: 'actorUserId', ellipsis: true },
                    {
                      title: 'Resource',
                      dataIndex: 'resourceType',
                      width: 120,
                    },
                    {
                      title: 'Resource ID',
                      dataIndex: 'resourceId',
                      ellipsis: true,
                    },
                  ]}
                />
                {auditCursor ? (
                  <Button
                    loading={auditBusy}
                    onClick={() => void loadAudit(auditCursor, true)}
                  >{t('platform.h_4cj11z')}</Button>
                ) : null}
              </Space>
            ),
          },
        ]}
      />
    </Space>
  );
}

export default function PlatformPage() {
  return (
    <Suspense fallback={<SurfaceState kind="loading" />}>
      <PlatformInner />
    </Suspense>
  );
}
