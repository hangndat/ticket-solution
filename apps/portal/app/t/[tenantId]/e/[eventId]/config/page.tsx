'use client';

import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Typography,
} from 'antd';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ConfigVersionSummary, EventDetail } from '@ticket/contracts';
import {
  apiErrorMessage,
  portalGet,
  portalMutate,
} from '../../../../../../src/client/portal-fetch';
import {
  buildMinimalConfigPayload,
  hasTermsContent,
  isMinimalBrandOk,
} from '../../../../../../src/prep/default-config';
import { bffEvent, bffEventAction } from '../../../../../../src/prep/bff-urls';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { SurfaceState } from '../../../../../../src/components/surface-state';

export default function ConfigBrandPage() {
  const params = useParams<{ tenantId: string; eventId: string }>();
  const { tenantId, eventId } = params;
  const access = useEventAccess(tenantId, eventId);
  const [versions, setVersions] = useState<ConfigVersionSummary[]>([]);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [kind, setKind] = useState<'loading' | 'ready' | 'error' | 'unknown'>(
    'loading',
  );
  const [message, setMessage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form] = Form.useForm<{
    organizationName: string;
    primaryColor: string;
    termsText: string;
  }>();

  const load = useCallback(async () => {
    await Promise.resolve();
    setKind('loading');
    const [c, d] = await Promise.all([
      portalGet(bffEventAction(tenantId, eventId, 'config-versions')),
      portalGet(bffEvent(tenantId, eventId)),
    ]);
    if (c.networkError || c.timedOut || c.status >= 500) {
      setKind('unknown');
      setMessage('Chưa rõ kết quả tải lịch sử cấu hình.');
      return;
    }
    if (c.status !== 200 || !c.json || typeof c.json !== 'object') {
      setKind('error');
      setMessage(apiErrorMessage(c.json, `HTTP ${c.status}`));
      return;
    }
    const items = Array.isArray((c.json as { items?: unknown }).items)
      ? ((c.json as { items: ConfigVersionSummary[] }).items as ConfigVersionSummary[])
      : [];
    setVersions(items);
    if (d.status === 200 && d.json && typeof d.json === 'object') {
      setDetail(d.json as EventDetail);
    }

    const published = items.find((i) => i.published);
    const tip = items[0];
    if (tip) {
      const preview = await portalGet(
        `${bffEventAction(tenantId, eventId, 'config-versions')}/${tip.version}/preview`,
      );
      if (
        preview.status === 200 &&
        preview.json &&
        typeof preview.json === 'object'
      ) {
        const payload = (preview.json as { payload?: unknown }).payload;
        if (payload && typeof payload === 'object') {
          const brand = (payload as {
            brand?: { organizationName?: string; primaryColor?: string };
          }).brand;
          const sections = (payload as {
            sections?: Array<{ kind: string; body?: { text?: string } }>;
          }).sections;
          const terms = sections?.find((s) => s.kind === 'terms');
          form.setFieldsValue({
            organizationName: brand?.organizationName ?? '',
            primaryColor: brand?.primaryColor ?? '#9b3a18',
            termsText:
              typeof terms?.body?.text === 'string' ? terms.body.text : '',
          });
        }
      } else if (!published) {
        form.setFieldsValue({
          organizationName: '',
          primaryColor: '#9b3a18',
          termsText: '',
        });
      }
    } else {
      form.setFieldsValue({
        organizationName: '',
        primaryColor: '#9b3a18',
        termsText: '',
      });
    }
    setKind('ready');
  }, [tenantId, eventId, form]);

  useEffect(() => {
    if (access.kind !== 'ready') return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
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

  const canConfig = access.permissions.some((p) =>
    ['event.config', 'config.publish', 'event.update'].includes(p),
  );
  const publishedVersion =
    versions.find((v) => v.published)?.version ?? null;

  async function saveDraft() {
    setBusy(true);
    setNotice(null);
    try {
      const values = await form.validateFields();
      const payload = buildMinimalConfigPayload({
        organizationName: values.organizationName,
        primaryColor: values.primaryColor,
        termsText: values.termsText,
      });
      if (!isMinimalBrandOk(payload) || !hasTermsContent(payload)) {
        setNotice('Thiếu brand tối thiểu hoặc điều khoản.');
        return;
      }
      const res = await portalMutate(
        bffEventAction(tenantId, eventId, 'config-versions'),
        { payload, schemaVersion: 1 },
      );
      if (res.networkError || res.timedOut || res.status >= 500) {
        setNotice('Chưa rõ kết quả lưu draft — không coi là đã lưu.');
        return;
      }
      if (res.status >= 200 && res.status < 300) {
        setNotice('Đã lưu bản nháp cấu hình (chưa publish).');
        void load();
        return;
      }
      setNotice(apiErrorMessage(res.json, 'Không lưu được draft.'));
    } finally {
      setBusy(false);
    }
  }

  async function publishTip() {
    const tip = versions[0];
    if (!tip) {
      setNotice('Chưa có phiên bản để xuất bản — lưu draft trước.');
      return;
    }
    Modal.confirm({
      title: 'Xuất bản cấu hình?',
      content: (
        <Alert
          type="warning"
          showIcon
          message="Publish ≠ mở redeem ≠ mở Gate"
          description={`Sẽ publish version ${tip.version}. Không tự mở redeem/Gate.`}
        />
      ),
      okText: 'Xuất bản',
      cancelText: 'Huỷ',
      onOk: async () => {
        const res = await portalMutate(
          bffEventAction(tenantId, eventId, 'publish'),
          { expectedVersion: tip.version },
        );
        if (res.networkError || res.status >= 500) {
          setNotice('Chưa rõ kết quả publish.');
          return;
        }
        if (res.status >= 200 && res.status < 300) {
          setNotice('Đã publish cấu hình.');
          void load();
          return;
        }
        setNotice(apiErrorMessage(res.json, 'Publish thất bại.'));
      },
    });
  }

  function rollbackTo(targetVersion: number) {
    if (!detail || publishedVersion == null) {
      setNotice('Thiếu revision hoặc published version để rollback.');
      return;
    }
    Modal.confirm({
      title: `Rollback về version ${targetVersion}?`,
      content:
        'Rollback tạo version mới (append-only), không rewind lịch sử. Cần xác nhận.',
      okText: 'Rollback',
      okButtonProps: { danger: true },
      cancelText: 'Huỷ',
      onOk: async () => {
        const res = await portalMutate(
          `${bffEventAction(tenantId, eventId, 'config')}/rollback`,
          {
            targetVersion,
            expectedPublishedVersion: publishedVersion,
            expectedRevision: detail.revision,
          },
        );
        if (res.networkError || res.status >= 500) {
          setNotice('Chưa rõ kết quả rollback.');
          return;
        }
        if (res.status >= 200 && res.status < 300) {
          setNotice('Đã rollback (version mới đã publish).');
          void load();
          return;
        }
        setNotice(apiErrorMessage(res.json, 'Rollback thất bại.'));
      },
    });
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        Cấu hình / brand / xuất bản
      </Typography.Title>
      <Alert
        type="info"
        showIcon
        message="Publish ≠ redeem ≠ Gate"
        description="Lưu draft và publish khóa nội dung sự kiện. Không mở cửa sổ redeem khách và không bật cổng quét trên portal."
      />

      {kind === 'loading' ? <SurfaceState kind="loading" /> : null}
      {kind === 'unknown' ? (
        <Alert
          type="warning"
          showIcon
          message="Chưa rõ kết quả"
          description={message}
          action={
            <Button size="small" onClick={() => void load()}>
              Kiểm tra lại
            </Button>
          }
        />
      ) : null}
      {kind === 'error' ? (
        <SurfaceState
          kind="error"
          description={message}
          onRetry={() => void load()}
        />
      ) : null}

      {kind === 'ready' ? (
        <>
          <Form form={form} layout="vertical" style={{ maxWidth: 480 }} disabled={!canConfig}>
            <Form.Item
              name="organizationName"
              label="Tên tổ chức (brand)"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="primaryColor"
              label="Màu chính"
              rules={[{ required: true }]}
            >
              <Input placeholder="#9b3a18" />
            </Form.Item>
            <Form.Item
              name="termsText"
              label="Điều khoản (plain text)"
              rules={[{ required: true }]}
            >
              <Input.TextArea rows={4} />
            </Form.Item>
            <Space>
              <Button
                type="primary"
                loading={busy}
                disabled={!canConfig}
                onClick={() => void saveDraft()}
              >
                Lưu draft
              </Button>
              <Button
                disabled={!canConfig || !access.permissions.includes('config.publish')}
                onClick={() => void publishTip()}
              >
                Xuất bản tip
              </Button>
            </Space>
          </Form>

          <Typography.Title level={5}>Lịch sử phiên bản</Typography.Title>
          <Table
            rowKey="version"
            dataSource={versions}
            pagination={false}
            columns={[
              { title: 'Version', dataIndex: 'version' },
              {
                title: 'Published',
                dataIndex: 'published',
                render: (v: boolean) => (v ? 'yes' : 'no'),
              },
              { title: 'Tạo lúc', dataIndex: 'createdAt' },
              {
                title: '',
                render: (_: unknown, row: ConfigVersionSummary) =>
                  !row.published && publishedVersion != null ? (
                    <Button
                      size="small"
                      danger
                      disabled={!canConfig}
                      onClick={() => rollbackTo(row.version)}
                    >
                      Rollback về đây
                    </Button>
                  ) : null,
              },
            ]}
          />
        </>
      ) : null}

      {notice ? <Alert type="info" showIcon message={notice} /> : null}
    </Space>
  );
}
