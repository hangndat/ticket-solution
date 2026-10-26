'use client';

import { ProTable, type ProColumns } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Select,
  Space,
  Tabs,
  Timeline,
  Typography,
} from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  InvitationSummary,
  StaffPendingRedemptionItem,
} from '@ticket/contracts';
import { portalGet } from '../client/portal-fetch';
import { bffEventAction } from '../prep/bff-urls';
import { interpretInvitationList } from '../ops/invitation';
import {
  interpretCsDetail,
  interpretCsList,
  type CsTicketDetail,
  type CsTicketSummary,
} from '../ops/cs';

type Kind = 'invitations' | 'redemptions' | 'tickets';
type Row = {
  key: string;
  state: string;
  email: string | null;
  sourceId: string;
  ticketTypeId: string;
  at: string;
  checkInAt?: string | null;
  notification?: CsTicketSummary['notification'];
  timeline: { at: string; kind: string; summary: string }[];
};
type Page = { rows: Row[]; nextCursor: string | null };
type Props = {
  tenantId: string;
  eventId: string;
  permissions: readonly string[];
};

const PAGE_SIZE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mask again at the view boundary even when an upstream masked field is malformed. */
function safeEmail(value: string | null): string {
  if (!value) return '—';
  const parts = value.split('@');
  if (parts.length !== 2 || !parts[1]) return '•••';
  const local = parts[0] ?? '';
  return `${local.slice(0, Math.min(2, local.length)).replace(/\*/g, '•')}•••@${parts[1]}`;
}

function formatAt(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date);
}

function validPage(
  value: unknown,
): value is { items: unknown[]; nextCursor: string | null } {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  return (
    Array.isArray(body.items) &&
    (body.nextCursor === null || typeof body.nextCursor === 'string')
  );
}

function requestRow(value: unknown): Row | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<StaffPendingRedemptionItem> &
    Record<string, unknown>;
  if (
    'email' in item ||
    'actorEmail' in item ||
    'phone' in item ||
    'token' in item
  )
    return null;
  if (
    typeof item.requestId !== 'string' ||
    item.status !== 'PENDING_REVIEW' ||
    typeof item.sourceId !== 'string' ||
    typeof item.ticketTypeId !== 'string' ||
    typeof item.submittedAt !== 'string' ||
    (item.actorEmailMasked !== null &&
      typeof item.actorEmailMasked !== 'string')
  )
    return null;
  return {
    key: item.requestId,
    state: item.status,
    email: item.actorEmailMasked,
    sourceId: item.sourceId,
    ticketTypeId: item.ticketTypeId,
    at: item.submittedAt,
    timeline: [
      {
        at: item.submittedAt,
        kind: 'request',
        summary: 'Đã gửi yêu cầu đổi mã',
      },
    ],
  };
}

function readPage(
  kind: Kind,
  status: number,
  body: unknown,
  networkError: boolean,
): Page | null {
  if (networkError || status !== 200) return null;
  if (kind === 'invitations') {
    const view = interpretInvitationList(status, body, false);
    if (view.kind !== 'list') return null;
    return {
      rows: view.items.map((item: InvitationSummary) => ({
        key: item.invitationId,
        state: item.state,
        email: item.invitedEmailMasked,
        sourceId: item.sourceId,
        ticketTypeId: item.ticketTypeId,
        at: item.expiresAt,
        timeline: [],
      })),
      nextCursor: view.nextCursor,
    };
  }
  if (kind === 'tickets') {
    const view = interpretCsList(status, body, false);
    if (view.kind !== 'list') return null;
    return {
      rows: view.items.map((item) => ({
        key: item.ticketId,
        state: item.state,
        email: item.ownerEmailMasked,
        sourceId: item.sourceId,
        ticketTypeId: item.ticketTypeId,
        at: item.createdAt,
        checkInAt: item.lastCheckInAt,
        notification: item.notification,
        timeline: [],
      })),
      nextCursor: view.cursor,
    };
  }
  if (!validPage(body)) return null;
  const rows = body.items.map(requestRow);
  if (rows.some((row) => row === null)) return null;
  return { rows: rows as Row[], nextCursor: body.nextCursor };
}

function queryPath(
  tenantId: string,
  eventId: string,
  kind: Kind,
  cursor: string | null,
  state: string,
  search: string,
): string {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) params.set('cursor', cursor);
  if (kind === 'invitations' && state) params.set('state', state);
  if (kind === 'redemptions') {
    params.set('status', 'PENDING_REVIEW');
    if (search) params.set('q', search);
  }
  if (kind === 'tickets' && search) params.set('q', search);
  return `${bffEventAction(tenantId, eventId, kind)}?${params}`;
}

export function GuestWorkspace({ tenantId, eventId, permissions }: Props) {
  const allowed = useMemo(
    () =>
      [
        ...(permissions.includes('inventory.import')
          ? [{ key: 'invitations', label: 'Lời mời' }]
          : []),
        ...(permissions.includes('redemption.approve')
          ? [{ key: 'redemptions', label: 'Yêu cầu đổi mã' }]
          : []),
        ...(permissions.includes('cs.lookup')
          ? [{ key: 'tickets', label: 'Vé' }]
          : []),
      ] as { key: Kind; label: string }[],
    [permissions],
  );
  const [kind, setKind] = useState<Kind>(allowed[0]?.key ?? 'tickets');
  const [state, setState] = useState('');
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState<Page>({ rows: [], nextCursor: null });
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Row | null>(null);
  const [detail, setDetail] = useState<CsTicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const detailRequest = useRef(0);
  const cursor = cursors[index] ?? null;

  useEffect(() => {
    if (!allowed.some((tab) => tab.key === kind)) return;
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setLoading(true);
        setError(null);
      }
    });
    void portalGet(
      queryPath(tenantId, eventId, kind, cursor, state, search),
    ).then((result) => {
      if (!active) return;
      const next = readPage(
        kind,
        result.status,
        result.json,
        result.networkError,
      );
      if (next) setPage(next);
      else
        setError(
          result.status === 403
            ? 'Bạn không có quyền xem danh sách này.'
            : 'Không tải được danh sách. Hãy thử lại.',
        );
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [tenantId, eventId, kind, cursor, state, search, revision, allowed]);

  const reset = useCallback(() => {
    setCursors([null]);
    setIndex(0);
    setPage({ rows: [], nextCursor: null });
  }, []);
  const open = useCallback(
    (row: Row) => {
      const request = ++detailRequest.current;
      setSelected(row);
      setDetail(null);
      setDetailError(false);
      setDetailLoading(kind === 'tickets');
      if (kind !== 'tickets') return;
      void portalGet(
        `${bffEventAction(tenantId, eventId, 'tickets')}/${encodeURIComponent(row.key)}`,
      ).then((result) => {
        if (request !== detailRequest.current) return;
        const view = interpretCsDetail(
          result.status,
          result.json,
          result.networkError,
          row.key,
        );
        if (view.kind === 'detail') setDetail(view.ticket);
        else setDetailError(true);
        setDetailLoading(false);
      });
    },
    [tenantId, eventId, kind],
  );

  const columns: ProColumns<Row>[] = [
    {
      title:
        kind === 'tickets'
          ? 'Mã vé'
          : kind === 'redemptions'
            ? 'Mã yêu cầu'
            : 'Mã lời mời',
      dataIndex: 'key',
      ellipsis: true,
      copyable: true,
      search: false,
    },
    {
      title: 'Email (ẩn một phần)',
      dataIndex: 'email',
      render: (_, row) => safeEmail(row.email),
      search: false,
    },
    {
      title:
        kind === 'tickets'
          ? 'Trạng thái vé'
          : kind === 'redemptions'
            ? 'Trạng thái yêu cầu'
            : 'Trạng thái lời mời',
      dataIndex: 'state',
      search: false,
    },
    { title: 'Nguồn', dataIndex: 'sourceId', ellipsis: true, search: false },
    {
      title: 'Loại vé',
      dataIndex: 'ticketTypeId',
      ellipsis: true,
      search: false,
    },
    {
      title:
        kind === 'invitations'
          ? 'Hết hạn'
          : kind === 'redemptions'
            ? 'Đã gửi'
            : 'Đã cấp',
      dataIndex: 'at',
      render: (_, row) => formatAt(row.at),
      search: false,
    },
    ...(kind === 'tickets'
      ? [
          {
            title: 'Check-in',
            dataIndex: 'checkInAt',
            render: (_: unknown, row: Row) => formatAt(row.checkInAt),
            search: false,
          } as ProColumns<Row>,
          {
            title: 'Thông báo',
            dataIndex: 'notification',
            render: (_: unknown, row: Row) =>
              row.notification
                ? `${row.notification.channel}: ${row.notification.providerStatus}`
                : '—',
            search: false,
          } as ProColumns<Row>,
        ]
      : []),
    {
      title: 'Chi tiết',
      valueType: 'option',
      render: (_, row) => (
        <Button type="link" onClick={() => open(row)}>
          Xem chi tiết
        </Button>
      ),
    },
  ];

  return (
    <>
      <Tabs
        activeKey={kind}
        onChange={(value) => {
          detailRequest.current += 1;
          setSelected(null);
          setKind(value as Kind);
          setState('');
          setSearch('');
          setDraft('');
          reset();
        }}
        items={allowed.map((tab) => ({ ...tab, children: null }))}
      />
      <Space wrap style={{ marginBottom: 16 }}>
        {kind === 'invitations' ? (
          <Select
            aria-label="Lọc trạng thái lời mời"
            style={{ minWidth: 180 }}
            value={state}
            onChange={(value) => {
              setState(value);
              reset();
            }}
            options={[
              { value: '', label: 'Mọi trạng thái' },
              ...['PENDING', 'DISPATCHED', 'CLAIMED', 'EXPIRED', 'REVOKED'].map(
                (value) => ({ value, label: value }),
              ),
            ]}
          />
        ) : null}
        {kind !== 'invitations' ? (
          <Input.Search
            aria-label={
              kind === 'tickets' ? 'Tìm vé trên máy chủ' : 'Tìm yêu cầu theo mã'
            }
            placeholder={
              kind === 'tickets'
                ? 'Email, mã vé hoặc mã đổi'
                : 'Mã yêu cầu đầy đủ'
            }
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onSearch={(value) => {
              const next = value.trim();
              if (kind === 'redemptions' && next && !UUID.test(next)) {
                setError('Nhập mã yêu cầu đầy đủ để tìm kiếm.');
                return;
              }
              setError(null);
              setSearch(next);
              reset();
              setRevision((current) => current + 1);
            }}
            allowClear
            style={{ width: 260 }}
          />
        ) : null}
        <Button
          onClick={() => {
            reset();
            setRevision((value) => value + 1);
          }}
        >
          Làm mới
        </Button>
      </Space>
      {kind === 'invitations' ? (
        <Typography.Text type="secondary">
          Danh sách lời mời hỗ trợ lọc trạng thái; tìm theo mã lời mời đang chờ
          API.
        </Typography.Text>
      ) : null}
      {error ? (
        <Alert
          type="error"
          showIcon
          message={error}
          action={
            <Button
              size="small"
              onClick={() => setRevision((value) => value + 1)}
            >
              Thử lại
            </Button>
          }
          style={{ marginTop: 12 }}
        />
      ) : null}
      {!error ? (
        <ProTable<Row>
          rowKey="key"
          columns={columns}
          dataSource={page.rows}
          loading={loading}
          options={false}
          search={false}
          pagination={false}
          scroll={{ x: 1000 }}
          locale={{
            emptyText: (
              <Empty description="Chưa có dữ liệu trong phạm vi lọc" />
            ),
          }}
        />
      ) : null}
      {!error ? (
        <Space style={{ marginTop: 12 }}>
          <Button
            disabled={loading || index === 0}
            onClick={() => setIndex((value) => value - 1)}
          >
            Trang trước
          </Button>
          <Typography.Text>Trang {index + 1}</Typography.Text>
          <Button
            disabled={loading || !page.nextCursor}
            onClick={() => {
              if (!page.nextCursor) return;
              setCursors((value) => [
                ...value.slice(0, index + 1),
                page.nextCursor,
              ]);
              setIndex((value) => value + 1);
            }}
          >
            Trang sau
          </Button>
        </Space>
      ) : null}
      <Drawer
        title={
          kind === 'tickets'
            ? 'Chi tiết vé'
            : kind === 'redemptions'
              ? 'Chi tiết yêu cầu'
              : 'Chi tiết lời mời'
        }
        open={selected !== null}
        onClose={() => {
          detailRequest.current += 1;
          setSelected(null);
          setDetail(null);
        }}
        width="min(480px, 100vw)"
      >
        {selected ? (
          <>
            <Descriptions
              column={1}
              size="small"
              bordered
              items={[
                { key: 'id', label: 'Mã', children: selected.key },
                {
                  key: 'email',
                  label: 'Email (ẩn một phần)',
                  children: safeEmail(
                    detail?.ownerEmailMasked ?? selected.email,
                  ),
                },
                {
                  key: 'state',
                  label:
                    kind === 'tickets'
                      ? 'Trạng thái vé'
                      : kind === 'redemptions'
                        ? 'Trạng thái yêu cầu'
                        : 'Trạng thái lời mời',
                  children: detail?.state ?? selected.state,
                },
                { key: 'source', label: 'Nguồn', children: selected.sourceId },
                {
                  key: 'type',
                  label: 'Loại vé',
                  children: selected.ticketTypeId,
                },
                ...(kind === 'tickets'
                  ? [
                      {
                        key: 'checkin',
                        label: 'Check-in',
                        children: formatAt(
                          detail?.lastCheckInAt ?? selected.checkInAt,
                        ),
                      },
                      {
                        key: 'notification',
                        label: 'Thông báo',
                        children: detail?.notification
                          ? `${detail.notification.channel}: ${detail.notification.providerStatus}`
                          : selected.notification
                            ? `${selected.notification.channel}: ${selected.notification.providerStatus}`
                            : '—',
                      },
                    ]
                  : []),
              ]}
            />
            <Typography.Title level={5} style={{ marginTop: 24 }}>
              Hoạt động
            </Typography.Title>
            {detailLoading ? (
              <Typography.Text>Đang tải hoạt động…</Typography.Text>
            ) : detailError ? (
              <Alert type="error" message="Không tải được chi tiết vé." />
            ) : (detail?.timeline ?? selected.timeline).length ? (
              <Timeline
                items={(detail?.timeline ?? selected.timeline).map(
                  (item, position) => ({
                    key: `${item.at}-${position}`,
                    children: (
                      <>
                        <strong>{item.summary}</strong>
                        <br />
                        <Typography.Text type="secondary">
                          {item.kind} · {formatAt(item.at)}
                        </Typography.Text>
                      </>
                    ),
                  }),
                )}
              />
            ) : (
              <Empty description="Chưa có hoạt động ghi nhận" />
            )}
          </>
        ) : null}
      </Drawer>
    </>
  );
}
