'use client';

import { Alert, Button, Flex, Form, Input, Result, Select, Space, Spin, Steps } from 'antd';
import { PortalPage } from '../../../../../src/components/portal-page';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  apiErrorCode,
  apiErrorMessage,
  portalMutate,
} from '../../../../../src/client/portal-fetch';
import { bffEvents } from '../../../../../src/prep/bff-urls';
import { useTenantAccess } from '../../../../../src/prep/use-event-access';
import { canPerformTenantAction } from '../../../../../src/nav/capability-policy';
import { usePortalLocale } from '../../../../../src/i18n';
import { SURFACE_MESSAGE_KEYS } from '../../../../../src/prep/surface-copy';
import { useUnsavedChanges } from '../../../../../src/nav/unsaved-changes';
import { useIntentMutation } from '../../../../../src/client/use-intent-mutation';
import { intentBlockMessageKey, intentBlockPresentation } from '../../../../../src/client/intent-mutation';

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
  const [dirty, setDirty] = useState(false);
  const [createdScope, setCreatedScope] = useState<string | null>(null);
  const createIntent = useIntentMutation<WizardValues>(tenantId, undefined, 'event.create');
  useUnsavedChanges(dirty, t('shell.unsaved.confirm'));

  if (access.kind === 'loading') return (
    <Flex
      vertical
      align="center"
      gap="middle"
      role="status"
      aria-busy="true"
      aria-label={t(SURFACE_MESSAGE_KEYS.loading)}
      suppressHydrationWarning
      style={{ padding: 48 }}
    >
      <Spin size="large" />
      <span>{t(SURFACE_MESSAGE_KEYS.loading)}</span>
    </Flex>
  );
  if (access.kind === 'error') {
    return (
      <Alert
        type="error"
        showIcon
        message={t(SURFACE_MESSAGE_KEYS.errorLoadFailed)}
        description={access.messageKey ? t(access.messageKey) : undefined}
        action={
          <Button size="small" onClick={() => window.location.reload()}>
            {t(SURFACE_MESSAGE_KEYS.retry)}
          </Button>
        }
        style={{ margin: 24 }}
      />
    );
  }
  if (access.kind === 'permission-denied') {
    return (
      <Result
        status="403"
        title={t(SURFACE_MESSAGE_KEYS.permissionTitle)}
        subTitle={t('events.h_ekk31m')}
        extra={
          <Button type="primary" onClick={() => {
          window.location.href = `/t/${tenantId}`;
        }}>
            {t(SURFACE_MESSAGE_KEYS.permissionGoAllowed)}
          </Button>
        }
      />
    );
  }
  if (!canPerformTenantAction('createEvent', access.tenant.tenantPermissions)) {
    return (
      <Result
        status="403"
        title={t(SURFACE_MESSAGE_KEYS.permissionTitle)}
        subTitle={t('events.h_1ognyxu')}
        extra={
          <Button type="primary" onClick={() => {
          window.location.href = `/t/${tenantId}/events`;
        }}>
            {t(SURFACE_MESSAGE_KEYS.permissionGoAllowed)}
          </Button>
        }
      />
    );
  }

  async function submit() {
    if (busy || createdScope === tenantId || createIntent.state === 'loading' || createIntent.state === 'blocked') return;
    setBusy(true);
    setNotice(null);
    try {
      const values = await form.validateFields();
      const outcome = await createIntent.run(
        values,
        (body) => portalMutate(bffEvents(tenantId), body),
        (res) => !!(res.json && typeof res.json === 'object' && typeof (res.json as { eventId?: unknown }).eventId === 'string' && (res.json as { eventId: string }).eventId.trim()),
      );
      if (outcome.kind === 'blocked') {
        setNotice({ type: 'warning', text: t(intentBlockMessageKey(outcome.reason)) });
        return;
      }
      if (outcome.kind === 'unknown') {
        setNotice({
          type: 'warning',
          text: t('events.h_npdcvo'),
        });
        return;
      }
      const res = outcome.response;
      if (outcome.kind === 'confirmed') {
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
        setCreatedScope(tenantId);
        setDirty(false);
        router.push(`/t/${tenantId}/e/${eventId}`);
        return;
      }
      setNotice({
        type: 'error',
        text: t('ops.export.apiRejected', {
          code: apiErrorCode(res.json) ?? `HTTP ${res.status}`,
          message: apiErrorMessage(res.json, t('events.h_hnm91l')),
        }),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalPage title={t('events.h_ek93o2')} subTitle={t('events.h_5zs7cf')}>
      <Steps
        current={step}
        items={[
          { title: t('events.h_1y0cdxe') },
          { title: t('events.h_1gq5nm') },
          { title: t('events.h_1q9os0g') },
        ]}
      />
      {createIntent.state === 'blocked' ? (
        <Alert type="warning" showIcon message={t(intentBlockPresentation(createIntent.reason).title)}
          description={t(intentBlockPresentation(createIntent.reason).description)}
          action={<Button size="small" onClick={() => {
            if (createIntent.reason === 'identity') window.location.reload();
            else router.push(`/t/${tenantId}/events`);
          }}>{t(intentBlockPresentation(createIntent.reason).action)}</Button>}
        />
      ) : null}
      <Form
        form={form}
        onValuesChange={() => setDirty(true)}
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
            <Form.Item
              name="timezone"
              label={t('events.h_8g8c9u')}
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="visibility"
              label={t('common.h_wqd4fq')}
              rules={[{ required: true }]}
            >
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
        <Button
          disabled={step === 0 || busy}
          onClick={() => setStep((s) => s - 1)}
        >
          {t('events.h_rft49v')}
        </Button>
        {step < 2 ? (
          <Button
            type="primary"
            disabled={busy}
            onClick={async () => {
              try {
                if (step === 0) {
                  await form.validateFields([
                    'name',
                    'slug',
                    'timezone',
                    'visibility',
                  ]);
                }
                setStep((s) => s + 1);
              } catch {
                /* field errors shown */
              }
            }}
          >
            {t('events.new.tiep')}
          </Button>
        ) : (
          <Button type="primary" loading={busy} disabled={createdScope === tenantId || createIntent.state === 'loading' || createIntent.state === 'blocked'} onClick={() => void submit()}>
            {t('events.h_ek93o2')}
          </Button>
        )}
      </Space>
    </PortalPage>
  );
}
