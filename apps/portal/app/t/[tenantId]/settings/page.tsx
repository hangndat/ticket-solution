'use client';

import { Alert, Button, Form, Input, Space, Typography } from 'antd';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  apiErrorMessage,
  portalGet,
  portalMutate,
} from '../../../../src/client/portal-fetch';
import { bffBranding } from '../../../../src/prep/bff-urls';
import { useTenantAccess } from '../../../../src/prep/use-event-access';
import { SurfaceState } from '../../../../src/components/surface-state';

type Branding = {
  displayName: string;
  primaryColor: string;
  secondaryColor: string | null;
  version: number;
};

export default function OrgSettingsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const access = useTenantAccess(tenantId);
  const [kind, setKind] = useState<'loading' | 'ready' | 'error' | 'unknown'>(
    'loading',
  );
  const [branding, setBranding] = useState<Branding | null>(null);
  const [message, setMessage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form] = Form.useForm<{
    displayName: string;
    primaryColor: string;
    secondaryColor?: string;
  }>();

  const suspended =
    access.kind === 'ready' && access.tenant.status === 'SUSPENDED';

  const load = useCallback(async () => {
    await Promise.resolve();
    setKind('loading');
    const res = await portalGet(bffBranding(tenantId));
    if (res.networkError || res.timedOut || res.status >= 500) {
      setKind('unknown');
      setMessage('Chưa rõ kết quả tải branding.');
      return;
    }
    if (res.status !== 200 || !res.json || typeof res.json !== 'object') {
      setKind('error');
      setMessage(apiErrorMessage(res.json, `HTTP ${res.status}`));
      return;
    }
    const b = res.json as Branding;
    setBranding(b);
    form.setFieldsValue({
      displayName: b.displayName,
      primaryColor: b.primaryColor,
      secondaryColor: b.secondaryColor ?? undefined,
    });
    setKind('ready');
  }, [tenantId, form]);

  useEffect(() => {
    if (access.kind !== 'ready' || suspended) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [access.kind, suspended, load]);

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
  if (!access.tenant.tenantPermissions.includes('tenant.profile')) {
    return (
      <SurfaceState
        kind="permission-denied"
        description="Thiếu quyền cấu hình tổ chức (tenant.profile)."
        onRetry={() => {
          window.location.href = `/t/${tenantId}`;
        }}
      />
    );
  }
  if (suspended) {
    return (
      <Alert
        type="error"
        showIcon
        message="Tổ chức bị tạm ngưng"
        description="Mọi thay đổi branding bị chặn (fail-closed)."
      />
    );
  }

  async function save() {
    if (!branding) return;
    setBusy(true);
    setNotice(null);
    try {
      const values = await form.validateFields();
      const res = await portalMutate(
        bffBranding(tenantId),
        {
          displayName: values.displayName.trim(),
          primaryColor: values.primaryColor.trim(),
          secondaryColor: values.secondaryColor?.trim() || null,
          expectedVersion: branding.version,
        },
        'PUT',
      );
      if (res.networkError || res.timedOut || res.status >= 500) {
        setNotice('Chưa rõ kết quả lưu branding — kiểm tra lại.');
        return;
      }
      if (res.status === 200) {
        setNotice('Đã cập nhật branding tổ chức.');
        void load();
        return;
      }
      setNotice(apiErrorMessage(res.json, `Không lưu được (HTTP ${res.status}).`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        Cấu hình tổ chức
      </Typography.Title>
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
          <Form form={form} layout="vertical" style={{ maxWidth: 480 }}>
            <Form.Item
              name="displayName"
              label="Tên hiển thị"
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
            <Form.Item name="secondaryColor" label="Màu phụ">
              <Input />
            </Form.Item>
            <Typography.Text type="secondary">
              Phiên bản hiện tại: {branding?.version ?? '—'}
            </Typography.Text>
          </Form>
          {notice ? <Alert type="info" showIcon message={notice} /> : null}
          <Button type="primary" loading={busy} onClick={() => void save()}>
            Lưu
          </Button>
        </>
      ) : null}
    </Space>
  );
}
