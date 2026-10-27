'use client';

import {
  Alert,
  Button,
  Descriptions,
  Flex,
  Form,
  Input,
  Result,
  Select,
  Space,
  Spin,
  Steps,
} from 'antd';
import { PortalPage } from '../../../../../src/components/portal-page';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
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
import { navigateAfterEventCreate } from '../../../../../src/client/event-create-navigation';
import { useIntentMutation } from '../../../../../src/client/use-intent-mutation';
import { intentBlockMessageKey, intentBlockPresentation } from '../../../../../src/client/intent-mutation';
import { eventFromMutation } from '../../../../../src/client/event-mutation-result';
import { InContextHelp } from '../../../../../src/components/in-context-help';
import {
  collectEventWizardValues,
  eventCreateUpstreamFromWizard,
  suggestEventSlugFromName,
  wizardReviewRows,
  type EventWizardValues,
} from '../../../../../src/client/event-wizard-values';

export default function CreateEventWizardPage() {
  const { t } = usePortalLocale();
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const access = useTenantAccess(tenantId);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tenantLimit, setTenantLimit] = useState(false);
  const [notice, setNotice] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);
  const [form] = Form.useForm<EventWizardValues>();
  const [dirty, setDirty] = useState(false);
  const slugEdited = useRef(false);
  const [createdScope, setCreatedScope] = useState<string | null>(null);
  const createIntent = useIntentMutation<EventWizardValues>(tenantId, undefined, 'event.create');
  useUnsavedChanges(dirty, t('shell.unsaved.confirm'));
  const watched = Form.useWatch([], form);

  const reviewBody = useMemo(
    () =>
      eventCreateUpstreamFromWizard({
        name: watched?.name ?? '',
        slug: watched?.slug ?? '',
        timezone: watched?.timezone ?? '',
        visibility: watched?.visibility ?? 'UNLISTED',
        venueName: watched?.venueName,
        venueAddress: watched?.venueAddress,
        contactEmail: watched?.contactEmail,
      }),
    [watched],
  );

  const reviewRows = useMemo(
    () =>
      wizardReviewRows(reviewBody, {
        name: t('events.h_1x97hc6'),
        slug: t('common.label.slug'),
        timezone: t('events.h_8g8c9u'),
        visibility: t('common.h_wqd4fq'),
        venue: t('events.h_1gq5nm'),
        contact: t('events.h_1xm22zn'),
        empty: t('events.new.reviewEmpty'),
      }),
    [reviewBody, t],
  );

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

  if (tenantLimit) {
    return (
      <PortalPage title={t('events.h_ek93o2')} subTitle={t('events.h_5zs7cf')}>
        <Result
          status="warning"
          title={t('events.new.tenantLimitTitle')}
          subTitle={t('events.new.tenantLimitBody')}
          extra={
            <Button type="primary" onClick={() => router.push(`/t/${tenantId}/events`)}>
              {t('events.new.tenantLimitCta')}
            </Button>
          }
        />
      </PortalPage>
    );
  }

  async function submit() {
    if (busy || createdScope === tenantId || createIntent.state === 'loading' || createIntent.state === 'blocked') return;
    setBusy(true);
    setNotice(null);
    try {
      const values = await collectEventWizardValues(form);
      const outcome = await createIntent.run(
        values,
        (body) => portalMutate(bffEvents(tenantId), body),
        (result) => eventFromMutation(result) !== null,
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
        const event = eventFromMutation(res);
        if (!event) {
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
        navigateAfterEventCreate(tenantId, event.eventId);
        return;
      }
      const code = apiErrorCode(res.json) ?? '';
      if (code === 'TENANT_LIMIT_REACHED') {
        setTenantLimit(true);
        return;
      }
      if (res.status === 409 && code === 'SLUG_TAKEN') {
        setStep(0);
        form.setFields([
          {
            name: 'slug',
            errors: [t('events.new.slugTaken')],
          },
        ]);
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

  function suggestSlugFromName() {
    if (slugEdited.current) return;
    const name = form.getFieldValue('name');
    if (typeof name !== 'string' || !name.trim()) return;
    const suggested = suggestEventSlugFromName(name);
    if (!suggested) return;
    form.setFieldValue('slug', suggested);
  }

  const stepHidden = (index: number) =>
    step === index ? undefined : { display: 'none' };

  return (
    <PortalPage title={t('events.h_ek93o2')} subTitle={t('events.h_5zs7cf')}>
      <InContextHelp messageKey="help.eventsNew" testId="events-new-help" />
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
        preserve
      >
        <div style={stepHidden(0)}>
          <Form.Item
            name="name"
            label={t('events.h_1x97hc6')}
            rules={[{ required: true, message: t('events.h_jq4yo3') }]}
          >
            <Input maxLength={120} onBlur={() => suggestSlugFromName()} />
          </Form.Item>
          <Form.Item
            name="slug"
            label={t('common.label.slug')}
            extra={t('events.new.slugHint')}
            rules={[
              { required: true, message: t('events.h_1xl1825') },
              {
                pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                message: t('events.h_13e7ycb'),
              },
            ]}
          >
            <Input
              maxLength={64}
              autoComplete="off"
              spellCheck={false}
              onChange={() => {
                slugEdited.current = true;
              }}
            />
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
        </div>
        <div style={stepHidden(1)}>
          <Form.Item name="venueName" label={t('events.h_b8z0sy')}>
            <Input />
          </Form.Item>
          <Form.Item name="venueAddress" label={t('events.h_1dipstx')}>
            <Input />
          </Form.Item>
          <Form.Item
            name="contactEmail"
            label={t('events.h_1xm22zn')}
            rules={[{ type: 'email', message: t('events.new.contactEmailInvalid') }]}
          >
            <Input type="email" />
          </Form.Item>
        </div>
        <div style={stepHidden(2)}>
          <Alert
            type="info"
            showIcon
            message={t('events.h_1o08rig')}
            description={t('events.h_1qeuedv')}
            style={{ marginBottom: 16 }}
          />
          <Descriptions
            bordered
            size="small"
            column={1}
            title={t('events.new.reviewPayloadTitle')}
            items={reviewRows.map((row) => ({
              key: row.label,
              label: row.label,
              children: row.value,
            }))}
          />
        </div>
      </Form>
      {notice ? (
        <Alert type={notice.type} showIcon message={notice.text} style={{ marginTop: 16 }} />
      ) : null}
      <Space style={{ marginTop: 16 }}>
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
                } else if (step === 1) {
                  await form.validateFields(['contactEmail']);
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
