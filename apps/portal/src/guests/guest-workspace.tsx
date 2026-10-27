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
import { isMessageKey, usePortalLocale, type PortalLocale } from '../i18n';
import { bffEventAction } from '../prep/bff-urls';
import { interpretInvitationList } from '../ops/invitation';
import {
  interpretCsDetail,
  interpretCsList,
  type CsTicketDetail,
  type CsTicketSummary,
} from '../ops/cs';
import {
  TICKET_ID_UUID,
  buildGuestListQueryPath,
  defaultGuestListKind,
  guestListKindFromHash,
  guestListKindToHash,
  invitationSearchBlocksPagination,
  ticketSearchBlocksPagination,
  type GuestListKind,
  validateInvitationIdSearch,
  validateTicketIdSearch,
} from './guest-list-query';

type Kind = GuestListKind;
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

/** Mask again at the view boundary even when an upstream masked field is malformed. */
function safeEmail(value: string | null): string {
  if (!value) return '—';
  const parts = value.split('@');
  if (parts.length !== 2 || !parts[1]) return '•••';
  const local = parts[0] ?? '';
  return `${local.slice(0, Math.min(2, local.length)).replace(/\*/g, '•')}•••@${parts[1]}`;
}

function formatAt(
  value: string | null | undefined,
  locale: PortalLocale,
): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'vi-VN', {
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
        summary: 'guests.timeline.redemptionSubmitted',
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

export function GuestWorkspace({ tenantId, eventId, permissions }: Props) {
  const { t, locale } = usePortalLocale();
  const allowed = useMemo(
    () =>
      [
        ...(permissions.includes('inventory.import')
          ? [{ key: 'invitations', label: t('guests.tab.invitations') }]
          : []),
        ...(permissions.includes('redemption.approve')
          ? [{ key: 'redemptions', label: t('guests.tab.redemptions') }]
          : []),
        ...(permissions.includes('cs.lookup')
          ? [{ key: 'tickets', label: t('guests.tab.tickets') }]
          : []),
      ] as { key: Kind; label: string }[],
    [permissions, t],
  );
  const [kind, setKind] = useState<Kind>(() =>
    defaultGuestListKind(permissions),
  );
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
  const ticketSearchActive =
    kind === 'tickets' && ticketSearchBlocksPagination(search);
  const invitationSearchActive =
    kind === 'invitations' && invitationSearchBlocksPagination(search);
  const uuidLookupActive = ticketSearchActive || invitationSearchActive;

  useEffect(() => {
    const syncKindFromHash = () => {
      const fromHash = guestListKindFromHash(window.location.hash);
      if (fromHash && allowed.some((tab) => tab.key === fromHash)) {
        setKind(fromHash);
      }
    };
    queueMicrotask(syncKindFromHash);
    window.addEventListener('hashchange', syncKindFromHash);
    return () => window.removeEventListener('hashchange', syncKindFromHash);
  }, [allowed]);

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
      buildGuestListQueryPath(
        tenantId,
        eventId,
        kind,
        cursor,
        state,
        search,
      ),
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
            ? t('guests.list.forbidden')
            : t('guests.list.loadFailed'),
        );
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [tenantId, eventId, kind, cursor, state, search, revision, allowed, t]);

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
          ? t('guests.col.ticketId')
          : kind === 'redemptions'
            ? t('ops.h_k67vfi')
            : t('ops.table.invitationId'),
      dataIndex: 'key',
      ellipsis: true,
      copyable: true,
      search: false,
    },
    {
      title: t('guests.col.emailMasked'),
      dataIndex: 'email',
      render: (_, row) => safeEmail(row.email),
      search: false,
    },
    {
      title:
        kind === 'tickets'
          ? t('ops.export.ticketStates')
          : kind === 'redemptions'
            ? t('guests.col.requestState')
            : t('guests.col.invitationState'),
      dataIndex: 'state',
      search: false,
    },
    {
      title: t('ops.table.source'),
      dataIndex: 'sourceId',
      ellipsis: true,
      search: false,
    },
    {
      title: t('ops.table.ticketType'),
      dataIndex: 'ticketTypeId',
      ellipsis: true,
      search: false,
    },
    {
      title:
        kind === 'invitations'
          ? t('ops.table.expires')
          : kind === 'redemptions'
            ? t('guests.col.sentAt')
            : t('guests.col.issuedAt'),
      dataIndex: 'at',
      render: (_, row) => formatAt(row.at, locale),
      search: false,
    },
    ...(kind === 'tickets'
      ? [
          {
            title: t('analytics.col.checkIn'),
            dataIndex: 'checkInAt',
            render: (_: unknown, row: Row) => formatAt(row.checkInAt, locale),
            search: false,
          } as ProColumns<Row>,
          {
            title: t('guests.h_1avy3de'),
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
      title: t('ops.table.timeline'),
      valueType: 'option',
      render: (_, row) => (
        <Button type="link" onClick={() => open(row)}>
          {t('guests.action.viewDetail')}
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
          window.location.hash = guestListKindToHash(value as Kind);
        }}
        items={allowed.map((tab) => ({ ...tab, children: null }))}
      />
      <Space wrap style={{ marginBottom: 16 }}>
        {kind === 'invitations' ? (
          <Select
            aria-label={t('guests.filter.invitationStateAria')}
            style={{ minWidth: 180 }}
            value={state}
            onChange={(value) => {
              setState(value);
              reset();
            }}
            options={[
              { value: '', label: t('guests.filter.allStates') },
              ...['PENDING', 'DISPATCHED', 'CLAIMED', 'EXPIRED', 'REVOKED'].map(
                (value) => ({ value, label: value }),
              ),
            ]}
          />
        ) : null}
        {kind === 'invitations' ? (
          <Input.Search
            aria-label={t('guests.search.invitationAria')}
            placeholder={t('guests.search.invitationPlaceholder')}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (error) setError(null);
            }}
            onSearch={(value) => {
              const next = value.trim();
              if (!next) {
                setError(null);
                setSearch('');
                reset();
                setRevision((current) => current + 1);
                return;
              }
              const validated = validateInvitationIdSearch(next);
              if (!validated.ok) {
                setError(t('guests.search.invitationUuidHint'));
                return;
              }
              setError(null);
              setSearch(validated.invitationId);
              reset();
              setRevision((current) => current + 1);
            }}
            allowClear
            style={{ width: 260 }}
          />
        ) : null}
        {kind !== 'invitations' ? (
          <Input.Search
            aria-label={
              kind === 'tickets'
                ? t('guests.search.ticketAria')
                : t('guests.search.redemptionAria')
            }
            placeholder={
              kind === 'tickets'
                ? t('guests.search.ticketPlaceholder')
                : t('guests.search.redemptionPlaceholder')
            }
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (error) setError(null);
            }}
            onSearch={(value) => {
              const next = value.trim();
              if (kind === 'tickets' && next) {
                const validated = validateTicketIdSearch(next);
                if (!validated.ok) {
                  setError(t('guests.search.ticketUuidHint'));
                  return;
                }
                setError(null);
                setSearch(validated.ticketId);
                reset();
                setRevision((current) => current + 1);
                return;
              }
              if (kind === 'redemptions' && next && !TICKET_ID_UUID.test(next)) {
                setError(t('guests.search.redemptionIdHint'));
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
          {t('gate.h_3keb7')}
        </Button>
      </Space>
      {kind === 'invitations' ? (
        <Typography.Text type="secondary">
          {t('guests.hint.invitationSearch')}
        </Typography.Text>
      ) : null}
      {kind === 'tickets' ? (
        <Typography.Text type="secondary">
          {t('guests.hint.ticketSearch')}
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
              {t('surface.action.retry')}
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
              <Empty description={t('guests.empty.filtered')} />
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
            {t('guests.page.prev')}
          </Button>
          <Typography.Text>
            {t('guests.page.current', { page: index + 1 })}
          </Typography.Text>
          <Button
            disabled={
              loading || !page.nextCursor || uuidLookupActive
            }
            onClick={() => {
              if (!page.nextCursor || uuidLookupActive) return;
              setCursors((value) => [
                ...value.slice(0, index + 1),
                page.nextCursor,
              ]);
              setIndex((value) => value + 1);
            }}
          >
            {t('guests.page.next')}
          </Button>
        </Space>
      ) : null}
      <Drawer
        title={
          kind === 'tickets'
            ? t('guests.drawer.ticket')
            : kind === 'redemptions'
              ? t('guests.drawer.request')
              : t('guests.drawer.invitation')
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
                { key: 'id', label: t('ops.table.id'), children: selected.key },
                {
                  key: 'email',
                  label: t('guests.col.emailMasked'),
                  children: safeEmail(
                    detail?.ownerEmailMasked ?? selected.email,
                  ),
                },
                {
                  key: 'state',
                  label:
                    kind === 'tickets'
                      ? t('ops.export.ticketStates')
                      : kind === 'redemptions'
                        ? t('guests.col.requestState')
                        : t('guests.col.invitationState'),
                  children: detail?.state ?? selected.state,
                },
                {
                  key: 'source',
                  label: t('ops.table.source'),
                  children: selected.sourceId,
                },
                {
                  key: 'type',
                  label: t('ops.table.ticketType'),
                  children: selected.ticketTypeId,
                },
                ...(kind === 'tickets'
                  ? [
                      {
                        key: 'checkin',
                        label: t('analytics.col.checkIn'),
                        children: formatAt(
                          detail?.lastCheckInAt ?? selected.checkInAt,
                          locale,
                        ),
                      },
                      {
                        key: 'notification',
                        label: t('guests.h_1avy3de'),
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
              {t('guests.activity.title')}
            </Typography.Title>
            {detailLoading ? (
              <Typography.Text>{t('guests.activity.loading')}</Typography.Text>
            ) : detailError ? (
              <Alert type="error" message={t('guests.detail.loadFailed')} />
            ) : (detail?.timeline ?? selected.timeline).length ? (
              <Timeline
                items={(detail?.timeline ?? selected.timeline).map(
                  (item, position) => ({
                    key: `${item.at}-${position}`,
                    children: (
                      <>
                        <strong>
                          {isMessageKey(item.summary)
                            ? t(item.summary)
                            : item.summary}
                        </strong>
                        <br />
                        <Typography.Text type="secondary">
                          {item.kind} · {formatAt(item.at, locale)}
                        </Typography.Text>
                      </>
                    ),
                  }),
                )}
              />
            ) : (
              <Empty description={t('guests.activity.empty')} />
            )}
          </>
        ) : null}
      </Drawer>
    </>
  );
}
