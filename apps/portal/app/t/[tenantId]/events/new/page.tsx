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
import { usePortalLocale } from '../../../../../src/i18n';

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
  const { t } = usePortalLocale();
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
        description={access.messageKey ? t(access.messageKey) : undefined}
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (access.kind === 'permission-denied') {
    return (
      <SurfaceState
        kind="permission-denied"
        description={t('events.h_ekk31m')}
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
        description={t('events.h_1ognyxu')}
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
          text: t('events.h_npdcvo'),
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
            text: t('events.h_74jvni'),
          });
          return;
        }
        setNotice({
          type: 'success',
          text: t('events.h_rpomry'),
        });
        router.push(`/t/${tenantId}/e/${eventId}`);
        return;
      }
      setNotice({
        type: 'error',
        text: t('ops.export.apiRejected', { code: apiErrorCode(res.json) ?? `HTTP ${res.status}`, message: apiErrorMessage(
          res.json,
          t('events.h_hnm91l'),
        ) }),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>{t('events.h_ek93o2')}</Typography.Title>
      <Typography.Paragraph type="secondary">{t('events.h_5zs7cf')}</Typography.Paragraph>
      <Steps
        current={step}
        items={[
          { title: t('events.h_1y0cdxe') },
          { title: t('events.h_1gq5nm') },
          { title: t('events.h_1q9os0g') },
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
              label={t('events.h_1x97hc6')}
              rules={[{ required: true, message: t('events.h_jq4yo3') }]}
            >
              <Input maxLength={120} />
            </Form.Item>
            <Form.Item
              name="slug"
              label="Slug"
              rules={[
                { required: true, message: t('events.h_1xl1825') },
                {
                  pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                  message: t('events.h_13e7ycb'),
                },
              ]}
            >
              <Input maxLength={64} autoComplete="off" spellCheck={false} />
            </Form.Item>
            <Form.Item name="timezone" label={t('events.h_8g8c9u')} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="visibility" label={t('common.h_wqd4fq')} rules={[{ required: true }]}>
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
            <Form.Item name="venueName" label={t('events.h_b8z0sy')}>
              <Input />
            </Form.Item>
            <Form.Item name="venueAddress" label={t('events.h_1dipstx')}>
              <Input />
            </Form.Item>
            <Form.Item name="contactEmail" label={t('events.h_1xm22zn')}>
              <Input type="email" />
            </Form.Item>
          </>
        ) : null}
        {step === 2 ? (
          <Alert
            type="info"
            showIcon
            message={t('events.h_1o08rig')}
            description={t('events.h_1qeuedv')}
          />
        ) : null}
      </Form>
      {notice ? (
        <Alert type={notice.type} showIcon message={notice.text} />
      ) : null}
      <Space>
        <Button disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>{t('events.h_rft49v')}</Button>
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
          >{t('events.new.tiep')}</Button>
        ) : (
          <Button type="primary" loading={busy} onClick={() => void submit()}>{t('events.h_ek93o2')}</Button>
        )}
      </Space>
    </Space>
  );
}
