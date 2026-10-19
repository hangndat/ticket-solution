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
  Tag,
  Typography,
} from 'antd';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  MembershipRole,
  PortalInviteSummary,
  PortalMemberSummary,
  RolePresetDto,
} from '@ticket/contracts';
import {
  apiErrorCode,
  apiErrorMessage,
  portalGet,
  portalMutate,
} from '../../../../src/client/portal-fetch';
import {
  bffInvites,
  bffMemberRole,
  bffMembers,
  bffRevokeInvite,
  bffRevokeMember,
  bffRolePresets,
} from '../../../../src/prep/bff-urls';
import { useTenantAccess } from '../../../../src/prep/use-event-access';
import { SurfaceState } from '../../../../src/components/surface-state';
import { usePortalLocale } from '../../../../src/i18n';
import { SavedViewsToolbar } from '../../../../src/views';
import {
  SYSTEM_MEMBERSHIP_ROLES,
  asRolePresetItems,
  buildRoleCatalogRows,
  isSystemMembershipRole,
  parseRoleSelectValue,
  roleLabel,
  roleSelectValue,
} from '../../../../src/ops/role-presets';

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
  const [presets, setPresets] = useState<RolePresetDto[]>([]);
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
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<PortalMemberSummary | null>(
    null,
  );
  const [assignRole, setAssignRole] = useState<MembershipRole>('Manager');
  const [assignBusy, setAssignBusy] = useState(false);
  const [form] = Form.useForm<{
    email: string;
    roleKey: string;
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

  const roleOptions = useMemo(() => {
    const system = {
      label: t('members.roles.groupSystem'),
      options: SYSTEM_MEMBERSHIP_ROLES.map((r) => ({ value: r, label: r })),
    };
    const presetGroup = {
      label: t('members.roles.groupPreset'),
      options: presets.map((p) => ({
        value: roleSelectValue({ presetId: p.presetId }),
        label: p.name,
      })),
    };
    return presetGroup.options.length > 0 ? [system, presetGroup] : [system];
  }, [presets, t]);

  const catalogRows = useMemo(
    () =>
      buildRoleCatalogRows(
        presets,
        members.filter((m) => !m.revokedAt).map((m) => m.role),
      ),
    [presets, members],
  );

  const selectedInviteDesc = Form.useWatch('roleKey', form);
  const selectedPreset = useMemo(() => {
    const parsed = parseRoleSelectValue(selectedInviteDesc ?? '');
    if (!parsed || typeof parsed === 'string') return null;
    return presets.find((p) => p.presetId === parsed.presetId) ?? null;
  }, [selectedInviteDesc, presets]);

  const reload = useCallback(async () => {
    await Promise.resolve();
    setLoadKind('loading');
    const [m, i, p] = await Promise.all([
      portalGet(bffMembers(tenantId)),
      portalGet(bffInvites(tenantId)),
      portalGet(bffRolePresets(tenantId)),
    ]);
    if (
      m.networkError ||
      i.networkError ||
      p.networkError ||
      m.timedOut ||
      i.timedOut ||
      p.timedOut ||
      m.status >= 500 ||
      i.status >= 500 ||
      p.status >= 500
    ) {
      setLoadKind('unknown');
      setMessage(t('members.h_oiatvx'));
      return;
    }
    if (m.status === 403 || i.status === 403 || p.status === 403) {
      setLoadKind('error');
      setMessage(t('members.h_5ptlts'));
      return;
    }
    if (m.status !== 200 || i.status !== 200) {
      setLoadKind('error');
      setMessage(
        t('members.loadFailedStatus', {
          members: m.status,
          invites: i.status,
        }),
      );
      return;
    }
    setMembers(asItems<PortalMemberSummary>(m.json));
    setInvites(asItems<PortalInviteSummary>(i.json));
    // Presets are additive — empty / soft-fail still allows system role-map UI.
    if (p.status === 200) {
      setPresets(asRolePresetItems(p.json));
    } else {
      setPresets([]);
    }
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

  function showLastOwnerGuard(code: string | null, fallback: string) {
    if (code === 'LAST_OWNER_REQUIRED') {
      Modal.error({
        title: t('members.roles.lastOwnerTitle'),
        content: t('members.roles.lastOwnerBody'),
      });
      return;
    }
    setNotice(fallback);
  }

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
      const role = parseRoleSelectValue(values.roleKey);
      if (!role) {
        setNotice(t('members.roles.invalidRole'));
        return;
      }
      const body: Record<string, unknown> = {
        email: values.email.trim(),
        role,
        idempotencyKey: crypto.randomUUID(),
      };
      const eventId = values.eventId?.trim();
      if (eventId) {
        body.eventAssignments = [
          { eventId, role: values.eventRole ?? 'Manager' },
        ];
      }
      const res = await portalMutate(bffInvites(tenantId), body);
      if (res.networkError || res.timedOut || res.status >= 500) {
        setNotice(t('members.h_aa8wpg'));
        return;
      }
      if (res.status === 200 || res.status === 201) {
        setNotice(t('members.h_xg2gwp'));
        form.resetFields(['email']);
        void reload();
        return;
      }
      const code = apiErrorCode(res.json);
      if (code === 'RESOURCE_NOT_FOUND') {
        Modal.error({
          title: t('members.roles.presetMissingTitle'),
          content: t('members.roles.presetMissingBody'),
        });
        return;
      }
      setNotice(
        t('ops.export.apiRejected', {
          code: code ?? res.status,
          message: apiErrorMessage(res.json, t('members.h_1qjqtw')),
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  function openAssign(row: PortalMemberSummary) {
    setAssignTarget(row);
    setAssignRole(
      isSystemMembershipRole(row.role) ? row.role : ('Manager' as MembershipRole),
    );
    setAssignOpen(true);
  }

  async function submitAssign() {
    if (!assignTarget) return;
    setAssignBusy(true);
    try {
      const res = await portalMutate(
        bffMemberRole(tenantId, assignTarget.membershipId),
        {
          role: assignRole,
          reason: t('members.roles.changeReason'),
        },
        'PATCH',
      );
      if (res.networkError || res.timedOut || res.status >= 500) {
        setNotice(t('members.roles.changeUnknown'));
        return;
      }
      if (res.status >= 200 && res.status < 300) {
        setNotice(t('members.roles.changeOk'));
        setAssignOpen(false);
        setAssignTarget(null);
        void reload();
        return;
      }
      showLastOwnerGuard(
        apiErrorCode(res.json),
        apiErrorMessage(res.json, t('members.roles.changeFailed')),
      );
    } finally {
      setAssignBusy(false);
    }
  }

  function confirmRevokeMember(membershipId: string) {
    Modal.confirm({
      title: t('members.h_1uecsno'),
      content: t('members.h_ltgqwp'),
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
          showLastOwnerGuard(
            apiErrorCode(res.json),
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
      <Typography.Title level={3} style={{ margin: 0 }}>
        {t('members.h_i0adgn')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {t('members.inviteEventsHint')}
      </Typography.Paragraph>

      <Alert
        type="info"
        showIcon
        message={t('members.roles.serverDefinedAlert')}
      />

      <Form
        form={form}
        layout="inline"
        initialValues={{
          roleKey: 'Manager',
          eventRole: 'Manager',
        }}
        style={{ rowGap: 12 }}
      >
        <Form.Item
          name="email"
          rules={[
            { required: true, type: 'email', message: t('members.h_1rjw0n9') },
          ]}
        >
          <Input placeholder="email@example.com" style={{ width: 220 }} />
        </Form.Item>
        <Form.Item
          name="roleKey"
          rules={[{ required: true, message: t('members.roles.pickRequired') }]}
        >
          <Select
            style={{ width: 220 }}
            options={roleOptions}
            placeholder={t('members.roles.pickPlaceholder')}
            aria-label={t('members.h_1mkpx3r')}
          />
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
            options={SYSTEM_MEMBERSHIP_ROLES.filter((r) => r !== 'Owner').map(
              (r) => ({
                value: r,
                label: r,
              }),
            )}
          />
        </Form.Item>
        <Button type="primary" loading={busy} onClick={() => void invite()}>
          {t('members.h_47dn03')}
        </Button>
      </Form>

      {selectedPreset ? (
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          {t('members.roles.presetReadonly', {
            name: selectedPreset.name,
            version: selectedPreset.schemaVersion,
          })}
        </Typography.Paragraph>
      ) : null}

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
          options={SYSTEM_MEMBERSHIP_ROLES.map((r) => ({ value: r, label: r }))}
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
            <Button size="small" onClick={() => void reload()}>
              {t('surface.action.recheck')}
            </Button>
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
              label: t('members.tabUsers', { count: members.length }),
              children: (
                <Table
                  rowKey="membershipId"
                  dataSource={filteredMembers}
                  pagination={false}
                  columns={[
                    { title: 'Email', dataIndex: 'emailMasked' },
                    {
                      title: t('members.h_1mkpx3r'),
                      render: (_: unknown, row: PortalMemberSummary) =>
                        roleLabel(row.role, presets),
                    },
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
                          <Space>
                            <Button
                              size="small"
                              onClick={() => openAssign(row)}
                            >
                              {t('members.roles.assignCta')}
                            </Button>
                            <Button
                              danger
                              size="small"
                              onClick={() =>
                                confirmRevokeMember(row.membershipId)
                              }
                            >
                              {t('members.h_1w0agno')}
                            </Button>
                          </Space>
                        ),
                    },
                  ]}
                />
              ),
            },
            {
              key: 'invites',
              label: t('members.tabInvites', { count: invites.length }),
              children: (
                <Table
                  rowKey="inviteId"
                  dataSource={invites}
                  pagination={false}
                  columns={[
                    { title: 'Email', dataIndex: 'emailMasked' },
                    {
                      title: t('members.h_1mkpx3r'),
                      render: (_: unknown, row: PortalInviteSummary) =>
                        roleLabel(row.role, presets),
                    },
                    {
                      title: t('ops.export.statusButton'),
                      dataIndex: 'state',
                    },
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
                          >
                            {t('members.h_1w0agno')}
                          </Button>
                        ) : null,
                    },
                  ]}
                />
              ),
            },
            {
              key: 'roles',
              label: t('members.tabRoles'),
              children: (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Alert
                    type="info"
                    showIcon
                    message={t('members.roles.catalogHint')}
                  />
                  <Table
                    rowKey="key"
                    dataSource={catalogRows}
                    pagination={false}
                    expandable={{
                      expandedRowRender: (row) =>
                        row.kind === 'preset' ? (
                          <Space wrap size={[4, 4]}>
                            {row.tenantPermissions.map((p) => (
                              <Tag key={`t-${p}`}>{p}</Tag>
                            ))}
                            {row.eventPermissions.map((p) => (
                              <Tag key={`e-${p}`} color="blue">
                                {p}
                              </Tag>
                            ))}
                            {row.tenantPermissions.length === 0 &&
                            row.eventPermissions.length === 0 ? (
                              <Typography.Text type="secondary">
                                {t('members.roles.noPermList')}
                              </Typography.Text>
                            ) : null}
                          </Space>
                        ) : (
                          <Typography.Text type="secondary">
                            {t('members.roles.systemMapHint')}
                          </Typography.Text>
                        ),
                      rowExpandable: () => true,
                    }}
                    columns={[
                      { title: t('members.roles.colName'), dataIndex: 'name' },
                      {
                        title: t('members.roles.colKind'),
                        render: (_: unknown, row) =>
                          row.kind === 'system'
                            ? t('members.roles.kindSystem')
                            : t('members.roles.kindPreset'),
                      },
                      {
                        title: t('members.roles.colMembers'),
                        dataIndex: 'memberCount',
                      },
                      {
                        title: t('members.roles.colSchema'),
                        render: (_: unknown, row) =>
                          row.schemaVersion ?? '—',
                      },
                      {
                        title: t('members.roles.colUpdated'),
                        render: (_: unknown, row) => row.updatedAt ?? '—',
                      },
                    ]}
                  />
                </Space>
              ),
            },
          ]}
        />
      ) : null}

      <Modal
        title={t('members.roles.assignTitle')}
        open={assignOpen}
        onCancel={() => {
          setAssignOpen(false);
          setAssignTarget(null);
        }}
        onOk={() => void submitAssign()}
        confirmLoading={assignBusy}
        okText={t('members.roles.save')}
        cancelText={t('config.huy')}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={t('members.roles.serverDefinedAlert')}
          />
          <Typography.Text type="secondary">
            {assignTarget?.emailMasked ?? '—'}
          </Typography.Text>
          <Select
            style={{ width: '100%' }}
            value={assignRole}
            onChange={(v) => setAssignRole(v)}
            options={SYSTEM_MEMBERSHIP_ROLES.map((r) => ({
              value: r,
              label: r,
            }))}
            aria-label={t('members.h_1mkpx3r')}
          />
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t('members.roles.assignBuiltInOnly')}
          </Typography.Paragraph>
        </Space>
      </Modal>
    </Space>
  );
}
