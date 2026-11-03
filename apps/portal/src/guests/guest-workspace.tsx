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
import { portalGet } from '../client/portal-fetch';
import { isMessageKey, usePortalLocale, type PortalLocale } from '../i18n';
import { bffEventAction } from '../prep/bff-urls';
import { interpretCsDetail, type CsTicketDetail } from '../ops/cs';
import {
  TICKET_ID_UUID,
  defaultGuestListKind,
  guestListKindFromHash,
  guestListKindToHash,
  invitationSearchBlocksPagination,
  ticketSearchBlocksPagination,
  type GuestListKind,
  validateInvitationIdSearch,
  validateTicketIdSearch,
} from './guest-list-query';
import { useGuestListPage } from './use-guest-list-page';
import type { GuestListRow as Row } from './guest-list-page';

type Kind = GuestListKind;
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
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [index, setIndex] = useState(0);
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

  const list = useGuestListPage({
    tenantId,
    eventId,
    kind,
    cursor,
    state,
    search,
    revision,
    allowed: allowed.some((tab) => tab.key === kind),
    forbiddenMessage: t('guests.list.forbidden'),
    loadFailedMessage: t('guests.list.loadFailed'),
  });
  const { page, loading, error, setError, reset: resetPage } = list;

  const reset = useCallback(() => {
    setCursors([null]);
    setIndex(0);
    resetPage();
  }, [resetPage]);
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
              if (
                kind === 'redemptions' &&
                next &&
                !TICKET_ID_UUID.test(next)
              ) {
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
            emptyText: <Empty description={t('guests.empty.filtered')} />,
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
            disabled={loading || !page.nextCursor || uuidLookupActive}
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
