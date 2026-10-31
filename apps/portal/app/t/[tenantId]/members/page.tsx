'use client';

import {
  ProForm,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { Alert, Button, Flex, Form, Modal, Result, Select, Space, Spin, Tabs, Tag, Typography } from 'antd';
import { PortalPage } from '../../../../src/components/portal-page';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';
import { useActorState as useState } from '../../../../src/client/use-actor-state';
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
  bffMemberEventAssignment,
  bffMemberRole,
  bffMembers,
  bffRevokeInvite,
  bffRevokeMember,
  bffRolePresets,
} from '../../../../src/prep/bff-urls';
import { InContextHelp } from '../../../../src/components/in-context-help';
import {
  eventAssignmentRoleAllowed,
  isLastOwnerError,
} from '../../../../src/ops/members-policy';
import { useTenantAccess } from '../../../../src/prep/use-event-access';
import { canPerformTenantAction } from '../../../../src/nav/capability-policy';
import { usePortalLocale } from '../../../../src/i18n';
import { SURFACE_MESSAGE_KEYS } from '../../../../src/prep/surface-copy';
import { useUnsavedChanges } from '../../../../src/nav/unsaved-changes';
import { SavedViewsToolbar } from '../../../../src/views';
import { useMutationIntent } from '../../../../src/client/use-mutation-intent';
import { MutationIntentAlert } from '../../../../src/client/mutation-intent-alert';
import { inviteDeliveryFailed, inviteQueued } from '../../../../src/client/invite-outcome';
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
  const inviteIntent = useMutationIntent(tenantId, undefined, 'invite-member');
  const revokeMemberIntent = useMutationIntent(tenantId, undefined, 'revoke-member');
  const revokeInviteIntent = useMutationIntent(tenantId, undefined, 'revoke-invite');
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty, t('shell.unsaved.confirm'));
  const [roleFilter, setRoleFilter] = useState<MembershipRole | undefined>();
  const [statusFilter, setStatusFilter] = useState<
    'ACTIVE' | 'REVOKED' | undefined
  >();
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<PortalMemberSummary | null>(
    null,
  );
  const [assignRole, setAssignRole] = useState<MembershipRole>('Manager');
  const [assignEventId, setAssignEventId] = useState<string | undefined>();
  const [assignEventRole, setAssignEventRole] = useState<MembershipRole>('Manager');
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
    if (isLastOwnerError(code)) {
      Modal.error({
        title: t('members.roles.lastOwnerTitle'),
        content: t('members.roles.lastOwnerBody'),
      });
      return;
    }
    setNotice(fallback);
  }

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
        subTitle={t('events.h_ekk31m')}
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
  if (
    !canPerformTenantAction('manageMembers', access.tenant.tenantPermissions)
  ) {
    return (
      <Result
        status="403"
        title={t(SURFACE_MESSAGE_KEYS.permissionTitle)}
        subTitle={t('members.h_d390z8')}
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
      };
      const eventId = values.eventId?.trim();
      if (eventId) {
        body.eventAssignments = [
          { eventId, role: values.eventRole ?? 'Manager' },
        ];
      }
      const outcome = await inviteIntent.run(body, (request) => portalMutate(bffInvites(tenantId), request), inviteQueued);
        if (outcome.kind === 'blocked') {
          setNotice(t('members.intent.inviteUnknown'));
          return;
        }
      const res = outcome.response;
      if (res.networkError || res.timedOut || res.status >= 500) {
        setNotice(t('members.h_aa8wpg'));
        return;
      }
        if (inviteDeliveryFailed(res)) {
          setNotice(t('members.intent.inviteDeliveryFailed'));
        void reload();
        return;
      }
      if (inviteQueued(res)) {
        setDirty(false);
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
      isSystemMembershipRole(row.role)
        ? row.role
        : ('Manager' as MembershipRole),
    );
    const current = row.eventAssignments.find((a) => !a.revokedAt);
    setAssignEventId(current?.eventId);
    setAssignEventRole('Manager');
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
        if (assignEventId && eventAssignmentRoleAllowed(assignEventRole)) {
          const assigned = await portalMutate(
            bffMemberEventAssignment(
              tenantId,
              assignTarget.membershipId,
              assignEventId,
            ),
            {
              role: assignEventRole,
              reason: t('members.roles.changeReason'),
            },
            'PUT',
          );
          if (assigned.networkError || assigned.timedOut || assigned.status >= 500) {
            setNotice(t('members.roles.changeUnknown'));
            return;
          }
          if (assigned.status < 200 || assigned.status >= 300) {
            showLastOwnerGuard(
              apiErrorCode(assigned.json),
              apiErrorMessage(assigned.json, t('members.roles.changeFailed')),
            );
            return;
          }
        }
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
        const outcome = await revokeMemberIntent.run(
          { membershipId, reason: t('members.h_tzdfji') },
          (body) => portalMutate(bffRevokeMember(tenantId, membershipId),
            { reason: body.reason, idempotencyKey: body.idempotencyKey }),
          (res) => res.status >= 200 && res.status < 300 && !!res.json &&
            typeof res.json === 'object' && (res.json as { membershipId?: unknown }).membershipId === membershipId,
        );
        if (outcome.kind === 'blocked') {
          setNotice(t('members.intent.revokeMemberUnknown'));
          return;
        }
        const res = outcome.response;
        if (res.status >= 200 && res.status < 300 && !!res.json &&
          typeof res.json === 'object' && (res.json as { membershipId?: unknown }).membershipId === membershipId) {
          setNotice(t('members.h_o8fp08'));
          void reload();
        } else if (res.status >= 200 && res.status < 300) {
          setNotice(t('members.intent.revokeMemberUnconfirmed'));
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
        const outcome = await revokeInviteIntent.run(
          { inviteId, reason: t('members.h_1p47lt5') },
          (body) => portalMutate(bffRevokeInvite(tenantId, inviteId),
            { reason: body.reason, idempotencyKey: body.idempotencyKey }),
          (res) => res.status >= 200 && res.status < 300 && !!res.json &&
            typeof res.json === 'object' && (res.json as { inviteId?: unknown; state?: unknown }).inviteId === inviteId &&
            (res.json as { state?: unknown }).state === 'REVOKED',
        );
        if (outcome.kind === 'blocked') {
          setNotice(t('members.intent.revokeInviteUnknown'));
          return;
        }
        const res = outcome.response;
        if (res.status >= 200 && res.status < 300 && !!res.json &&
          typeof res.json === 'object' && (res.json as { inviteId?: unknown; state?: unknown }).inviteId === inviteId &&
          (res.json as { state?: unknown }).state === 'REVOKED') {
          setNotice(t('members.h_2cjh4e'));
          void reload();
        } else if (res.status >= 200 && res.status < 300) {
          setNotice(t('members.intent.revokeMemberUnconfirmed'));
        } else {
          setNotice(apiErrorMessage(res.json, t('members.h_1tmqlzc')));
        }
      },
    });
  }

  const memberColumns: ProColumns<PortalMemberSummary>[] = [
    { title: 'Email', dataIndex: 'emailMasked' },
    {
      title: t('members.h_1mkpx3r'),
      render: (_, row) => roleLabel(row.role, presets),
    },
    {
      title: t('ops.export.statusButton'),
      render: (_, row) =>
        row.revokedAt ? t('members.status.revoked') : t('members.status.active'),
    },
    {
      title: t('members.h_r0iic4'),
      render: (_, row) =>
        row.eventAssignments.length
          ? row.eventAssignments
              .map((a) => {
                const ev = access.events.find((e) => e.eventId === a.eventId);
                return ev?.name ?? a.eventId.slice(0, 8);
              })
              .join(', ')
          : '—',
    },
  ];

  return (
    <PortalPage
      title={t('members.h_i0adgn')}
      subTitle={t('members.inviteEventsHint')}
    >
      <InContextHelp messageKey="members.help" testId="members-help" />
      <Alert
        type="info"
        showIcon
        message={t('members.roles.serverDefinedAlert')}
      />

      <ProForm
        form={form}
        onValuesChange={() => setDirty(true)}
        layout="inline"
        initialValues={{
          roleKey: 'Manager',
          eventRole: 'Manager',
        }}
        style={{ rowGap: 12 }}
        submitter={{
          searchConfig: { submitText: t('members.h_47dn03') },
          submitButtonProps: { loading: busy },
        }}
        onFinish={() => void invite()}
      >
        <ProFormText
          name="email"
          rules={[
            { required: true, type: 'email', message: t('members.h_1rjw0n9') },
          ]}
          fieldProps={{
            placeholder: 'email@example.com',
            style: { width: 220 },
          }}
        />
        <ProFormSelect
          name="roleKey"
          rules={[{ required: true, message: t('members.roles.pickRequired') }]}
          fieldProps={{
            style: { width: 220 },
            options: roleOptions,
            placeholder: t('members.roles.pickPlaceholder'),
            'aria-label': t('members.h_1mkpx3r'),
          }}
        />
        <ProFormSelect
          name="eventId"
          fieldProps={{
            allowClear: true,
            placeholder: t('members.h_1fi9vwv'),
            style: { width: 220 },
            options: access.events.map((e) => ({
              value: e.eventId,
              label: e.name,
            })),
          }}
        />
        <ProFormSelect
          name="eventRole"
          fieldProps={{
            style: { width: 140 },
            options: SYSTEM_MEMBERSHIP_ROLES.filter((r) => r !== 'Owner').map(
              (r) => ({ value: r, label: r }),
            ),
          }}
        />
      </ProForm>

      {selectedPreset ? (
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          {t('members.roles.presetReadonly', {
            name: selectedPreset.name,
            version: selectedPreset.schemaVersion,
          })}
        </Typography.Paragraph>
      ) : null}

      {notice ? <Alert type="info" showIcon message={notice} /> : null}
      <MutationIntentAlert pending={inviteIntent.pending} needsReconciliation={inviteIntent.needsReconciliation}
        onCheck={() => void reload()} onStartNew={inviteIntent.release} />
      <MutationIntentAlert pending={revokeMemberIntent.pending} needsReconciliation={revokeMemberIntent.needsReconciliation}
        onCheck={() => void reload()} onStartNew={revokeMemberIntent.release} />
      <MutationIntentAlert pending={revokeInviteIntent.pending} needsReconciliation={revokeInviteIntent.needsReconciliation}
        onCheck={() => void reload()} onStartNew={revokeInviteIntent.release} />

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

      {loadKind === 'loading' ? (
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
  ) : null}
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
        <Alert
        type="error"
        showIcon
        message={t(SURFACE_MESSAGE_KEYS.errorLoadFailed)}
        description={message}
        action={
          <Button size="small" onClick={() => void reload()}>
            {t(SURFACE_MESSAGE_KEYS.retry)}
          </Button>
        }
        style={{ margin: 24 }}
      />
      ) : null}
      {loadKind === 'ready' ? (
        <Tabs
          items={[
            {
              key: 'members',
              label: t('members.tabUsers', { count: members.length }),
              children: (
                <ProTable<PortalMemberSummary>
                  rowKey="membershipId"
                  dataSource={filteredMembers}
                  search={false}
                  options={false}
                  pagination={false}
                  columns={[
                    ...memberColumns,
                    {
                      title: '',
                      render: (_, row) =>
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
                <ProTable<PortalInviteSummary>
                  rowKey="inviteId"
                  dataSource={invites}
                  search={false}
                  options={false}
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
                <Space
                  direction="vertical"
                  size="middle"
                  style={{ width: '100%' }}
                >
                  <Alert
                    type="info"
                    showIcon
                    message={t('members.roles.catalogHint')}
                  />
                  <ProTable
                    rowKey="key"
                    dataSource={catalogRows}
                    search={false}
                    options={false}
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
                        render: (_: unknown, row) => row.schemaVersion ?? '—',
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
          <Typography.Text>{t('members.assign.eventLabel')}</Typography.Text>
          <Select
            allowClear
            style={{ width: '100%' }}
            value={assignEventId}
            onChange={(v) => setAssignEventId(v)}
            options={access.events.map((e) => ({
              value: e.eventId,
              label: e.name,
            }))}
            aria-label={t('members.assign.eventLabel')}
          />
          <Typography.Text>{t('members.assign.eventRole')}</Typography.Text>
          <Select
            style={{ width: '100%' }}
            value={assignEventRole}
            onChange={(v) => setAssignEventRole(v)}
            options={SYSTEM_MEMBERSHIP_ROLES.filter((r) =>
              eventAssignmentRoleAllowed(r),
            ).map((r) => ({
              value: r,
              label: r,
            }))}
            aria-label={t('members.assign.eventRole')}
          />
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t('members.roles.assignBuiltInOnly')}
          </Typography.Paragraph>
        </Space>
      </Modal>
    </PortalPage>
  );
}
