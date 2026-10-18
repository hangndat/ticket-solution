'use client';

import {
  Alert,
  Button,
  Form,
  Input,
  Select,
  Space,
  Steps,
  Typography,
} from 'antd';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  apiErrorCode,
  apiErrorMessage,
  portalMutate,
} from '../../../../../src/client/portal-fetch';
import { bffEvents } from '../../../../../src/prep/bff-urls';
import { useTenantAccess } from '../../../../../src/prep/use-event-access';
import { SurfaceState } from '../../../../../src/components/surface-state';

type WizardValues = {
  slug: string;
  name: string;
  timezone: string;
  visibility: 'PUBLIC' | 'UNLISTED';
  venueName?: string;
  venueAddress?: string;
  contactEmail?: string;
};

export default function CreateEventWizardPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const access = useTenantAccess(tenantId);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);
  const [form] = Form.useForm<WizardValues>();

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
  if (!access.tenant.tenantPermissions.includes('event.create')) {
    return (
      <SurfaceState
        kind="permission-denied"
        description="Thiếu quyền tạo sự kiện (event.create)."
        onRetry={() => {
          window.location.href = `/t/${tenantId}/events`;
        }}
      />
    );
  }

  async function submit() {
    setBusy(true);
    setNotice(null);
    try {
      const values = await form.validateFields();
      const res = await portalMutate(bffEvents(tenantId), {
        ...values,
        idempotencyKey: crypto.randomUUID(),
      });
      if (res.networkError || res.timedOut || res.status === 0 || res.status >= 500) {
        setNotice({
          type: 'warning',
          text: 'Chưa rõ kết quả tạo sự kiện. Không coi là đã tạo — kiểm tra lại danh sách.',
        });
        return;
      }
      if (res.status === 200 || res.status === 201) {
        const eventId =
          res.json &&
          typeof res.json === 'object' &&
          typeof (res.json as { eventId?: unknown }).eventId === 'string'
            ? ((res.json as { eventId: string }).eventId as string)
            : null;
        if (!eventId) {
          setNotice({
            type: 'warning',
            text: 'Máy chủ trả về thành công nhưng thiếu eventId — chưa rõ sự kiện mới.',
          });
          return;
        }
        setNotice({
          type: 'success',
          text: 'Đã tạo sự kiện. Đang chuyển tới tổng quan…',
        });
        router.push(`/t/${tenantId}/e/${eventId}`);
        return;
      }
      setNotice({
        type: 'error',
        text: `${apiErrorCode(res.json) ?? `HTTP ${res.status}`}: ${apiErrorMessage(
          res.json,
          'Không tạo được sự kiện.',
        )}`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        Tạo sự kiện
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Tổ chức đã chọn từ ngữ cảnh route — không cần dán UUID tenant.
      </Typography.Paragraph>
      <Steps
        current={step}
        items={[
          { title: 'Cơ bản' },
          { title: 'Địa điểm / liên hệ' },
          { title: 'Xác nhận' },
        ]}
      />
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          timezone: 'Asia/Ho_Chi_Minh',
          visibility: 'UNLISTED',
        }}
        disabled={busy}
      >
        {step === 0 ? (
          <>
            <Form.Item
              name="name"
              label="Tên sự kiện"
              rules={[{ required: true, message: 'Nhập tên sự kiện' }]}
            >
              <Input maxLength={120} />
            </Form.Item>
            <Form.Item
              name="slug"
              label="Slug"
              rules={[
                { required: true, message: 'Nhập slug' },
                {
                  pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                  message: 'Slug chỉ gồm a-z, 0-9 và dấu gạch ngang',
                },
              ]}
            >
              <Input maxLength={64} autoComplete="off" spellCheck={false} />
            </Form.Item>
            <Form.Item name="timezone" label="Múi giờ" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="visibility" label="Hiển thị" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'UNLISTED', label: 'UNLISTED' },
                  { value: 'PUBLIC', label: 'PUBLIC' },
                ]}
              />
            </Form.Item>
          </>
        ) : null}
        {step === 1 ? (
          <>
            <Form.Item name="venueName" label="Tên địa điểm">
              <Input />
            </Form.Item>
            <Form.Item name="venueAddress" label="Địa chỉ">
              <Input />
            </Form.Item>
            <Form.Item name="contactEmail" label="Email liên hệ">
              <Input type="email" />
            </Form.Item>
          </>
        ) : null}
        {step === 2 ? (
          <Alert
            type="info"
            showIcon
            message="Xác nhận tạo"
            description="Sự kiện mới ở trạng thái DRAFT. Publish cấu hình ≠ mở redeem ≠ mở Gate quét."
          />
        ) : null}
      </Form>
      {notice ? (
        <Alert type={notice.type} showIcon message={notice.text} />
      ) : null}
      <Space>
        <Button disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
          Quay lại
        </Button>
        {step < 2 ? (
          <Button
            type="primary"
            disabled={busy}
            onClick={async () => {
              try {
                if (step === 0) {
                  await form.validateFields(['name', 'slug', 'timezone', 'visibility']);
                }
                setStep((s) => s + 1);
              } catch {
                /* field errors shown */
              }
            }}
          >
            Tiếp
          </Button>
        ) : (
          <Button type="primary" loading={busy} onClick={() => void submit()}>
            Tạo sự kiện
          </Button>
        )}
      </Space>
    </Space>
  );
}
