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
import { useCallback, useEffect, useState } from 'react';
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
  const [form] = Form.useForm<{
    email: string;
    role: MembershipRole;
    eventId?: string;
    eventRole?: MembershipRole;
  }>();

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
        'Chưa rõ kết quả tải thành viên/lời mời. Không giả định danh sách trống.',
      );
      return;
    }
    if (m.status === 403 || i.status === 403) {
      setLoadKind('error');
      setMessage('Thiếu quyền members.manage.');
      return;
    }
    if (m.status !== 200 || i.status !== 200) {
      setLoadKind('error');
      setMessage(`Không tải được danh sách (members ${m.status}, invites ${i.status}).`);
      return;
    }
    setMembers(asItems<PortalMemberSummary>(m.json));
    setInvites(asItems<PortalInviteSummary>(i.json));
    setLoadKind('ready');
  }, [tenantId]);

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
        description={access.message}
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (access.kind === 'permission-denied') {
    return (
      <SurfaceState
        kind="permission-denied"
        description="Thiếu quyền tổ chức."
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
        description="Thiếu quyền quản lý thành viên (members.manage)."
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
          'Chưa rõ kết quả gửi lời mời. Không coi là đã gửi — kiểm tra lại.',
        );
        return;
      }
      if (res.status === 200 || res.status === 201) {
        setNotice('Đã tạo lời mời (ACCEPTED ≠ đã giao email).');
        form.resetFields(['email']);
        void reload();
        return;
      }
      setNotice(
        `${apiErrorCode(res.json) ?? res.status}: ${apiErrorMessage(
          res.json,
          'Không gửi được lời mời.',
        )}`,
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmRevokeMember(membershipId: string) {
    Modal.confirm({
      title: 'Thu hồi thành viên?',
      content:
        'Yêu cầu tiếp theo của thành viên sẽ bị chặn. Không khẳng định đã xóa phiên trên mọi thiết bị.',
      okText: 'Thu hồi',
      okButtonProps: { danger: true },
      cancelText: 'Huỷ',
      onOk: async () => {
        const res = await portalMutate(bffRevokeMember(tenantId, membershipId), {
          reason: 'Owner revoke từ portal staff directory',
          idempotencyKey: crypto.randomUUID(),
        });
        if (res.status >= 200 && res.status < 300) {
          setNotice('Đã thu hồi thành viên.');
          void reload();
        } else if (res.networkError || res.status >= 500) {
          setNotice('Chưa rõ kết quả thu hồi — kiểm tra lại.');
        } else {
          setNotice(
            apiErrorMessage(res.json, 'Không thu hồi được thành viên.'),
          );
        }
      },
    });
  }

  function confirmRevokeInvite(inviteId: string) {
    Modal.confirm({
      title: 'Thu hồi lời mời?',
      okText: 'Thu hồi',
      okButtonProps: { danger: true },
      cancelText: 'Huỷ',
      onOk: async () => {
        const res = await portalMutate(bffRevokeInvite(tenantId, inviteId), {
          reason: 'Revoke invite từ portal',
          idempotencyKey: crypto.randomUUID(),
        });
        if (res.status >= 200 && res.status < 300) {
          setNotice('Đã thu hồi lời mời.');
          void reload();
        } else {
          setNotice(apiErrorMessage(res.json, 'Không thu hồi được lời mời.'));
        }
      },
    });
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        Thành viên & lời mời
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Email được che (masked). Vai trò theo allowlist máy chủ — không gửi quyền
        tùy ý. Gán sự kiện: chọn từ danh sách đã khám phá, tránh dán UUID tay.
      </Typography.Paragraph>

      <Form
        form={form}
        layout="inline"
        initialValues={{ role: 'Manager', eventRole: 'Manager' }}
        style={{ rowGap: 12 }}
      >
        <Form.Item
          name="email"
          rules={[{ required: true, type: 'email', message: 'Email hợp lệ' }]}
        >
          <Input placeholder="email@example.com" style={{ width: 220 }} />
        </Form.Item>
        <Form.Item name="role" rules={[{ required: true }]}>
          <Select style={{ width: 140 }} options={ROLES.map((r) => ({ value: r, label: r }))} />
        </Form.Item>
        <Form.Item name="eventId">
          <Select
            allowClear
            placeholder="Gán sự kiện (tuỳ chọn)"
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
        <Button type="primary" loading={busy} onClick={() => void invite()}>
          Gửi lời mời
        </Button>
      </Form>

      {notice ? <Alert type="info" showIcon message={notice} /> : null}

      {loadKind === 'loading' ? <SurfaceState kind="loading" /> : null}
      {loadKind === 'unknown' ? (
        <Alert
          type="warning"
          showIcon
          message="Chưa rõ kết quả"
          description={message}
          action={
            <Button size="small" onClick={() => void reload()}>
              Kiểm tra lại
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
              label: `Thành viên (${members.length})`,
              children: (
                <Table
                  rowKey="membershipId"
                  dataSource={members}
                  pagination={false}
                  columns={[
                    { title: 'Email', dataIndex: 'emailMasked' },
                    { title: 'Vai trò', dataIndex: 'role' },
                    {
                      title: 'Trạng thái',
                      render: (_: unknown, row: PortalMemberSummary) =>
                        row.revokedAt ? 'REVOKED' : 'ACTIVE',
                    },
                    {
                      title: 'Sự kiện gán',
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
                          >
                            Thu hồi
                          </Button>
                        ),
                    },
                  ]}
                />
              ),
            },
            {
              key: 'invites',
              label: `Lời mời (${invites.length})`,
              children: (
                <Table
                  rowKey="inviteId"
                  dataSource={invites}
                  pagination={false}
                  columns={[
                    { title: 'Email', dataIndex: 'emailMasked' },
                    { title: 'Vai trò', dataIndex: 'role' },
                    { title: 'Trạng thái', dataIndex: 'state' },
                    { title: 'Giao', dataIndex: 'deliveryState' },
                    { title: 'Hết hạn', dataIndex: 'expiresAt' },
                    {
                      title: '',
                      render: (_: unknown, row: PortalInviteSummary) =>
                        row.state === 'PENDING' ? (
                          <Button
                            danger
                            size="small"
                            onClick={() => confirmRevokeInvite(row.inviteId)}
                          >
                            Thu hồi
                          </Button>
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
