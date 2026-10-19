'use client';

import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
} from 'antd';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  MembershipRole,
  PortalInviteSummary,
  PortalMemberSummary,
} from '@ticket/contracts';
import {
  apiErrorCode,
  apiErrorMessage,
  portalGet,
  portalMutate,
} from '../../../../src/client/portal-fetch';
import {
  bffInvites,
  bffMembers,
  bffRevokeInvite,
  bffRevokeMember,
} from '../../../../src/prep/bff-urls';
import { useTenantAccess } from '../../../../src/prep/use-event-access';
import { SurfaceState } from '../../../../src/components/surface-state';
import { usePortalLocale } from '../../../../src/i18n';
import { SavedViewsToolbar } from '../../../../src/views';

const ROLES: MembershipRole[] = [
  'Owner',
  'Manager',
  'CS',
  'Supervisor',
  'Scanner',
];

function asItems<T>(json: unknown): T[] {
  if (!json || typeof json !== 'object') return [];
  const items = (json as { items?: unknown }).items;
  return Array.isArray(items) ? (items as T[]) : [];
}

export default function MembersPage() {
  const { t } = usePortalLocale();
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const access = useTenantAccess(tenantId);
  const [members, setMembers] = useState<PortalMemberSummary[]>([]);
  const [invites, setInvites] = useState<PortalInviteSummary[]>([]);
  const [loadKind, setLoadKind] = useState<
    'loading' | 'ready' | 'error' | 'unknown'
  >('loading');
  const [message, setMessage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<MembershipRole | undefined>();
  const [statusFilter, setStatusFilter] = useState<
    'ACTIVE' | 'REVOKED' | undefined
  >();
  const [form] = Form.useForm<{
    email: string;
    role: MembershipRole;
    eventId?: string;
    eventRole?: MembershipRole;
  }>();

  const filteredMembers = useMemo(() => {
    return members.filter((row) => {
      if (roleFilter && row.role !== roleFilter) return false;
      if (statusFilter === 'ACTIVE' && row.revokedAt) return false;
      if (statusFilter === 'REVOKED' && !row.revokedAt) return false;
      return true;
    });
  }, [members, roleFilter, statusFilter]);

  const reload = useCallback(async () => {
    await Promise.resolve();
    setLoadKind('loading');
    const [m, i] = await Promise.all([
      portalGet(bffMembers(tenantId)),
      portalGet(bffInvites(tenantId)),
    ]);
    if (
      m.networkError ||
      i.networkError ||
      m.timedOut ||
      i.timedOut ||
      m.status >= 500 ||
      i.status >= 500
    ) {
      setLoadKind('unknown');
      setMessage(
        t('members.h_oiatvx'),
      );
      return;
    }
    if (m.status === 403 || i.status === 403) {
      setLoadKind('error');
      setMessage(t('members.h_5ptlts'));
      return;
    }
    if (m.status !== 200 || i.status !== 200) {
      setLoadKind('error');
      setMessage(t('members.loadFailedStatus', { members: m.status, invites: i.status }));
      return;
    }
    setMembers(asItems<PortalMemberSummary>(m.json));
    setInvites(asItems<PortalInviteSummary>(i.json));
    setLoadKind('ready');
  }, [tenantId, t]);

  useEffect(() => {
    if (access.kind !== 'ready') return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void reload();
    });
    return () => {
      cancelled = true;
    };
  }, [access.kind, reload]);

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
        description={t('events.h_ekk31m')}
        onRetry={() => {
          window.location.href = `/t/${tenantId}`;
        }}
      />
    );
  }
  if (!access.tenant.tenantPermissions.includes('members.manage')) {
    return (
      <SurfaceState
        kind="permission-denied"
        description={t('members.h_d390z8')}
        onRetry={() => {
          window.location.href = `/t/${tenantId}`;
        }}
      />
    );
  }

  async function invite() {
    setBusy(true);
    setNotice(null);
    try {
      const values = await form.validateFields();
      const body: Record<string, unknown> = {
        email: values.email.trim(),
        role: values.role,
        idempotencyKey: crypto.randomUUID(),
      };
      const eventId = values.eventId?.trim();
      if (eventId) {
        // Event comes from org switcher/list — paste only if assignment needed.
        body.eventAssignments = [
          { eventId, role: values.eventRole ?? 'Manager' },
        ];
      }
      const res = await portalMutate(bffInvites(tenantId), body);
      if (res.networkError || res.timedOut || res.status >= 500) {
        setNotice(
          t('members.h_aa8wpg'),
        );
        return;
      }
      if (res.status === 200 || res.status === 201) {
        setNotice(t('members.h_xg2gwp'));
        form.resetFields(['email']);
        void reload();
        return;
      }
      setNotice(
        t('ops.export.apiRejected', { code: apiErrorCode(res.json) ?? res.status, message: apiErrorMessage(
          res.json,
          t('members.h_1qjqtw'),
        ) }),
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmRevokeMember(membershipId: string) {
    Modal.confirm({
      title: t('members.h_1uecsno'),
      content:
        t('members.h_ltgqwp'),
      okText: t('members.h_1w0agno'),
      okButtonProps: { danger: true },
      cancelText: t('config.huy'),
      onOk: async () => {
        const res = await portalMutate(bffRevokeMember(tenantId, membershipId), {
          reason: t('members.h_tzdfji'),
          idempotencyKey: crypto.randomUUID(),
        });
        if (res.status >= 200 && res.status < 300) {
          setNotice(t('members.h_o8fp08'));
          void reload();
        } else if (res.networkError || res.status >= 500) {
          setNotice(t('members.h_suvvlr'));
        } else {
          setNotice(
            apiErrorMessage(res.json, t('members.h_7tkx6u')),
          );
        }
      },
    });
  }

  function confirmRevokeInvite(inviteId: string) {
    Modal.confirm({
      title: t('members.h_aeura8'),
      okText: t('members.h_1w0agno'),
      okButtonProps: { danger: true },
      cancelText: t('config.huy'),
      onOk: async () => {
        const res = await portalMutate(bffRevokeInvite(tenantId, inviteId), {
          reason: t('members.h_1p47lt5'),
          idempotencyKey: crypto.randomUUID(),
        });
        if (res.status >= 200 && res.status < 300) {
          setNotice(t('members.h_2cjh4e'));
          void reload();
        } else {
          setNotice(apiErrorMessage(res.json, t('members.h_1tmqlzc')));
        }
      },
    });
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>{t('members.h_i0adgn')}</Typography.Title>
      <Typography.Paragraph type="secondary">{t('members.inviteEventsHint')}</Typography.Paragraph>

      <Form
        form={form}
        layout="inline"
        initialValues={{ role: 'Manager', eventRole: 'Manager' }}
        style={{ rowGap: 12 }}
      >
        <Form.Item
          name="email"
          rules={[{ required: true, type: 'email', message: t('members.h_1rjw0n9') }]}
        >
          <Input placeholder="email@example.com" style={{ width: 220 }} />
        </Form.Item>
        <Form.Item name="role" rules={[{ required: true }]}>
          <Select style={{ width: 140 }} options={ROLES.map((r) => ({ value: r, label: r }))} />
        </Form.Item>
        <Form.Item name="eventId">
          <Select
            allowClear
            placeholder={t('members.h_1fi9vwv')}
            style={{ width: 220 }}
            options={access.events.map((e) => ({
              value: e.eventId,
              label: e.name,
            }))}
          />
        </Form.Item>
        <Form.Item name="eventRole">
          <Select
            style={{ width: 140 }}
            options={ROLES.filter((r) => r !== 'Owner').map((r) => ({
              value: r,
              label: r,
            }))}
          />
        </Form.Item>
        <Button type="primary" loading={busy} onClick={() => void invite()}>{t('members.h_47dn03')}</Button>
      </Form>

      {notice ? <Alert type="info" showIcon message={notice} /> : null}

      <SavedViewsToolbar
        tenantId={tenantId}
        eventId={null}
        surface="members"
        filters={{ role: roleFilter, status: statusFilter }}
        onApply={(next) => {
          setRoleFilter(next.filters.role as MembershipRole | undefined);
          setStatusFilter(
            next.filters.status as 'ACTIVE' | 'REVOKED' | undefined,
          );
        }}
      />
      <Space wrap role="search" aria-label={t('views.members.roleFilter')}>
        <Select
          allowClear
          placeholder={t('views.members.roleFilter')}
          style={{ minWidth: 160 }}
          value={roleFilter}
          options={ROLES.map((r) => ({ value: r, label: r }))}
          onChange={(v) => setRoleFilter(v)}
        />
        <Select
          allowClear
          placeholder={t('views.members.statusFilter')}
          style={{ minWidth: 160 }}
          value={statusFilter}
          options={[
            { value: 'ACTIVE', label: 'ACTIVE' },
            { value: 'REVOKED', label: 'REVOKED' },
          ]}
          onChange={(v) => setStatusFilter(v)}
        />
      </Space>

      {loadKind === 'loading' ? <SurfaceState kind="loading" /> : null}
      {loadKind === 'unknown' ? (
        <Alert
          type="warning"
          showIcon
          message={t('surface.unknown.title')}
          description={message}
          action={
            <Button size="small" onClick={() => void reload()}>{t('surface.action.recheck')}</Button>
          }
        />
      ) : null}
      {loadKind === 'error' ? (
        <SurfaceState
          kind="error"
          description={message}
          onRetry={() => void reload()}
        />
      ) : null}
      {loadKind === 'ready' ? (
        <Tabs
          items={[
            {
              key: 'members',
              label: t('members.membersCount', { count: members.length }),
              children: (
                <Table
                  rowKey="membershipId"
                  dataSource={filteredMembers}
                  pagination={false}
                  columns={[
                    { title: 'Email', dataIndex: 'emailMasked' },
                    { title: t('members.h_1mkpx3r'), dataIndex: 'role' },
                    {
                      title: t('ops.export.statusButton'),
                      render: (_: unknown, row: PortalMemberSummary) =>
                        row.revokedAt ? 'REVOKED' : 'ACTIVE',
                    },
                    {
                      title: t('members.h_r0iic4'),
                      render: (_: unknown, row: PortalMemberSummary) =>
                        row.eventAssignments.length
                          ? row.eventAssignments
                              .map((a) => {
                                const ev = access.events.find(
                                  (e) => e.eventId === a.eventId,
                                );
                                return ev?.name ?? a.eventId.slice(0, 8);
                              })
                              .join(', ')
                          : '—',
                    },
                    {
                      title: '',
                      render: (_: unknown, row: PortalMemberSummary) =>
                        row.revokedAt ? null : (
                          <Button
                            danger
                            size="small"
                            onClick={() => confirmRevokeMember(row.membershipId)}
                          >{t('members.h_1w0agno')}</Button>
                        ),
                    },
                  ]}
                />
              ),
            },
            {
              key: 'invites',
              label: t('members.invitesCount', { count: invites.length }),
              children: (
                <Table
                  rowKey="inviteId"
                  dataSource={invites}
                  pagination={false}
                  columns={[
                    { title: 'Email', dataIndex: 'emailMasked' },
                    { title: t('members.h_1mkpx3r'), dataIndex: 'role' },
                    { title: t('ops.export.statusButton'), dataIndex: 'state' },
                    { title: 'Giao', dataIndex: 'deliveryState' },
                    { title: t('members.h_ov3797'), dataIndex: 'expiresAt' },
                    {
                      title: '',
                      render: (_: unknown, row: PortalInviteSummary) =>
                        row.state === 'PENDING' ? (
                          <Button
                            danger
                            size="small"
                            onClick={() => confirmRevokeInvite(row.inviteId)}
                          >{t('members.h_1w0agno')}</Button>
                        ) : null,
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      ) : null}
    </Space>
  );
}
