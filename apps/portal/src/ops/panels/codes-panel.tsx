'use client';

import { Alert, Button, Input, Select, Space, Table } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type { PortalCodeState, PortalCodeSummary } from '@ticket/contracts';
import { portalGet } from '../../client/portal-fetch';
import { bffCodes } from '../../prep/bff-urls';
import {
  buildCodesQuery,
  interpretCodesPage,
  type CodesListView,
} from '../codes';

type Props = {
  tenantId: string;
  eventId: string;
};

const STATE_OPTIONS: { value: PortalCodeState; label: string }[] = [
  { value: 'AVAILABLE', label: 'AVAILABLE' },
  { value: 'HELD', label: 'HELD' },
  { value: 'CONSUMED', label: 'CONSUMED' },
];

export function CodesPanel({ tenantId, eventId }: Props) {
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<CodesListView | null>(null);
  const [items, setItems] = useState<PortalCodeSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<PortalCodeState | ''>('');
  const [sourceId, setSourceId] = useState('');
  const [ticketTypeId, setTicketTypeId] = useState('');
  const [lookup, setLookup] = useState('');

  const load = useCallback(
    async (cursor?: string | null, append = false) => {
      setBusy(true);
      const qs = buildCodesQuery({
        cursor,
        limit: 20,
        state: state || undefined,
        sourceId: sourceId.trim() || undefined,
        ticketTypeId: ticketTypeId.trim() || undefined,
        q: lookup.trim() || undefined,
      });
      const res = await portalGet(`${bffCodes(tenantId, eventId)}${qs}`);
      const next = interpretCodesPage(
        res.status,
        res.json,
        res.networkError || res.timedOut,
      );
      setView(next);
      if (next.kind === 'page') {
        setItems((prev) =>
          append ? [...prev, ...next.page.items] : next.page.items,
        );
        setNextCursor(next.page.nextCursor);
      } else if (!append) {
        setItems([]);
        setNextCursor(null);
      }
      setBusy(false);
    },
    [tenantId, eventId, state, sourceId, ticketTypeId, lookup],
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load(null, false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="Mã tồn kho (H-C1)"
        description="Chỉ codeId/state/sourceId/ticketTypeId. Không raw code, HMAC hay suffix bịa. Tra cứu exact hash phía server — không echo q trong kết quả."
      />
      <Space wrap>
        <Select
          allowClear
          placeholder="state"
          style={{ minWidth: 140 }}
          value={state || undefined}
          options={STATE_OPTIONS}
          onChange={(v) => setState((v as PortalCodeState | undefined) ?? '')}
        />
        <Input
          placeholder="sourceId (UUID catalog)"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          style={{ minWidth: 220 }}
          spellCheck={false}
        />
        <Input
          placeholder="ticketTypeId (UUID catalog)"
          value={ticketTypeId}
          onChange={(e) => setTicketTypeId(e.target.value)}
          style={{ minWidth: 220 }}
          spellCheck={false}
        />
        <Input.Password
          placeholder="Tra cứu mã exact (không lưu)"
          value={lookup}
          onChange={(e) => setLookup(e.target.value)}
          style={{ minWidth: 220 }}
          visibilityToggle={false}
          autoComplete="off"
        />
        <Button type="primary" loading={busy} onClick={() => void load(null, false)}>
          Lọc
        </Button>
      </Space>
      {view?.kind === 'rejected' || view?.kind === 'unknown' ? (
        <Alert
          type={view.kind === 'rejected' ? 'warning' : 'error'}
          showIcon
          message={view.message}
          data-testid="codes-list-status"
        />
      ) : null}
      <Table
        size="small"
        rowKey="codeId"
        loading={busy}
        dataSource={items}
        pagination={false}
        locale={{ emptyText: 'Không có mã khớp bộ lọc.' }}
        data-testid="codes-table"
        columns={[
          { title: 'Code ID', dataIndex: 'codeId', ellipsis: true },
          { title: 'State', dataIndex: 'state', width: 120 },
          { title: 'Source', dataIndex: 'sourceId', ellipsis: true },
          { title: 'Ticket type', dataIndex: 'ticketTypeId', ellipsis: true },
        ]}
      />
      {nextCursor ? (
        <Button loading={busy} onClick={() => void load(nextCursor, true)}>
          Trang tiếp
        </Button>
      ) : null}
    </Space>
  );
}
