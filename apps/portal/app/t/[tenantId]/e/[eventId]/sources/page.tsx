'use client';

import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type {
  PortalSourceSummary,
  PortalTicketTypeSummary,
} from '@ticket/contracts';
import {
  apiErrorMessage,
  portalGet,
  portalMutate,
} from '../../../../../../src/client/portal-fetch';
import { bffEventAction } from '../../../../../../src/prep/bff-urls';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { SurfaceState } from '../../../../../../src/components/surface-state';

export default function SourcesPage() {
  const params = useParams<{ tenantId: string; eventId: string }>();
  const { tenantId, eventId } = params;
  const access = useEventAccess(tenantId, eventId);
  const [items, setItems] = useState<PortalSourceSummary[]>([]);
  const [types, setTypes] = useState<PortalTicketTypeSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [kind, setKind] = useState<'loading' | 'ready' | 'empty' | 'error' | 'unknown'>(
    'loading',
  );
  const [message, setMessage] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form] = Form.useForm<{
    name: string;
    approvalMode: 'AUTO' | 'MANUAL';
    ticketTypeId: string;
  }>();

  const load = useCallback(
    async (next?: string | null) => {
      await Promise.resolve();
      setKind('loading');
      const qs = new URLSearchParams({ limit: '20' });
      if (next) qs.set('cursor', next);
      const [res, typesRes] = await Promise.all([
        portalGet(`${bffEventAction(tenantId, eventId, 'sources')}?${qs}`),
        portalGet(`${bffEventAction(tenantId, eventId, 'ticket-types')}?limit=50`),
      ]);
      if (res.networkError || res.timedOut || res.status >= 500) {
        setKind('unknown');
        setMessage('Chưa rõ kết quả tải nguồn mã.');
        return;
      }
      if (res.status !== 200 || !res.json || typeof res.json !== 'object') {
        setKind('error');
        setMessage(apiErrorMessage(res.json, `HTTP ${res.status}`));
        return;
      }
      const list = Array.isArray((res.json as { items?: unknown }).items)
        ? ((res.json as { items: PortalSourceSummary[] }).items as PortalSourceSummary[])
        : [];
      const nextCursor =
        typeof (res.json as { nextCursor?: unknown }).nextCursor === 'string'
          ? ((res.json as { nextCursor: string }).nextCursor as string)
          : null;
      setCursor(nextCursor);
      setItems(list);
      if (
        typesRes.status === 200 &&
        typesRes.json &&
        typeof typesRes.json === 'object' &&
        Array.isArray((typesRes.json as { items?: unknown }).items)
      ) {
        setTypes(
          (typesRes.json as { items: PortalTicketTypeSummary[] })
            .items as PortalTicketTypeSummary[],
        );
      }
      setKind(list.length === 0 ? 'empty' : 'ready');
    },
    [tenantId, eventId],
  );

  useEffect(() => {
    if (access.kind !== 'ready') return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load(null);
    });
    return () => {
      cancelled = true;
    };
  }, [access.kind, load]);

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
        description="Không có quyền sự kiện này."
        onRetry={() => {
          window.location.href = `/t/${tenantId}`;
        }}
      />
    );
  }

  async function createSource() {
    setBusy(true);
    setNotice(null);
    try {
      const values = await form.validateFields();
      const res = await portalMutate(
        bffEventAction(tenantId, eventId, 'sources'),
        {
          name: values.name.trim(),
          approvalMode: values.approvalMode,
          ticketTypeId: values.ticketTypeId,
        },
      );
      if (res.networkError || res.timedOut || res.status >= 500) {
        setNotice('Chưa rõ kết quả tạo nguồn — không coi là đã tạo.');
        return;
      }
      if (res.status === 200 || res.status === 201) {
        setNotice('Đã tạo nguồn mã.');
        setOpen(false);
        form.resetFields();
        void load(null);
        return;
      }
      setNotice(apiErrorMessage(res.json, 'Không tạo được nguồn.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Nguồn mã
        </Typography.Title>
        <Button type="primary" onClick={() => setOpen(true)}>
          Tạo nguồn
        </Button>
      </Space>

      {kind === 'loading' ? <SurfaceState kind="loading" /> : null}
      {kind === 'unknown' ? (
        <Alert
          type="warning"
          showIcon
          message="Chưa rõ kết quả"
          description={message}
          action={
            <Button size="small" onClick={() => void load(null)}>
              Kiểm tra lại
            </Button>
          }
        />
      ) : null}
      {kind === 'error' ? (
        <SurfaceState
          kind="error"
          description={message}
          onRetry={() => void load(null)}
        />
      ) : null}
      {kind === 'empty' ? (
        <SurfaceState
          kind="empty"
          description="Chưa có nguồn mã."
          emptyAction={
            <Button type="primary" onClick={() => setOpen(true)}>
              Tạo nguồn
            </Button>
          }
        />
      ) : null}
      {kind === 'ready' ? (
        <>
          <Table
            rowKey="sourceId"
            dataSource={items}
            pagination={false}
            columns={[
              { title: 'Tên', dataIndex: 'name' },
              { title: 'Duyệt', dataIndex: 'approvalMode' },
              {
                title: 'Loại vé',
                dataIndex: 'ticketTypeIds',
                render: (ids: string[]) =>
                  (ids ?? [])
                    .map((id) => {
                      const t = types.find((x) => x.ticketTypeId === id);
                      return t?.label ?? id.slice(0, 8);
                    })
                    .join(', ') || '—',
              },
            ]}
          />
          {cursor ? (
            <Button onClick={() => void load(cursor)}>Tải thêm</Button>
          ) : null}
        </>
      ) : null}

      {notice ? <Alert type="info" showIcon message={notice} /> : null}

      <Drawer
        title="Tạo nguồn mã"
        open={open}
        onClose={() => setOpen(false)}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ approvalMode: 'MANUAL' }}
        >
          <Form.Item name="name" label="Tên" rules={[{ required: true }]}>
            <Input maxLength={80} />
          </Form.Item>
          <Form.Item
            name="approvalMode"
            label="Chế độ duyệt"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'AUTO', label: 'AUTO' },
                { value: 'MANUAL', label: 'MANUAL' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="ticketTypeId"
            label="Loại vé"
            rules={[{ required: true, message: 'Chọn loại vé từ danh mục' }]}
          >
            <Select
              placeholder="Chọn loại vé đã tạo"
              options={types.map((t) => ({
                value: t.ticketTypeId,
                label: t.label,
              }))}
              notFoundContent="Chưa có loại vé — tạo ở mục Loại vé trước"
            />
          </Form.Item>
          <Button type="primary" loading={busy} onClick={() => void createSource()}>
            Tạo
          </Button>
        </Form>
      </Drawer>
    </Space>
  );
}
