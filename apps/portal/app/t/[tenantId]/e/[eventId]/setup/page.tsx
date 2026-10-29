'use client';

import { ProCard, ProForm, ProFormText } from '@ant-design/pro-components';
import { Alert, Button, Flex, Form, Modal, Result, Spin } from 'antd';
import { PortalPage } from '../../../../../../src/components/portal-page';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventDetail } from '@ticket/contracts';
import {
  apiErrorMessage,
  portalGet,
  portalMutate,
} from '../../../../../../src/client/portal-fetch';
import { bffEvent, bffEventAction } from '../../../../../../src/prep/bff-urls';
import { isEventPagePermitted } from '../../../../../../src/prep/event-access-resolver';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { canPerformEventAction } from '../../../../../../src/nav/capability-policy';
import { usePortalLocale } from '../../../../../../src/i18n';
import { SURFACE_MESSAGE_KEYS } from '../../../../../../src/prep/surface-copy';
import { useUnsavedChanges } from '../../../../../../src/nav/unsaved-changes';
import {
  applySetupReload,
  hasUnsavedSetupChanges,
} from '../../../../../../src/setup/setup-drafts';
import { useIntentMutation } from '../../../../../../src/client/use-intent-mutation';
import { intentBlockMessageKey, intentBlockPresentation } from '../../../../../../src/client/intent-mutation';

function clonedEventId(json: unknown): string | null {
  if (!json || typeof json !== 'object' || !('event' in json)) return null;
  const event = json.event;
  if (!event || typeof event !== 'object' || !('eventId' in event)) return null;
  return typeof event.eventId === 'string' && event.eventId.trim()
    ? event.eventId.trim()
    : null;
}

export default function EventSetupPage() {
  const { t } = usePortalLocale();
  const params = useParams<{ tenantId: string; eventId: string }>();
  const { tenantId, eventId } = params;
  const router = useRouter();
  const access = useEventAccess(tenantId, eventId);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [kind, setKind] = useState<'loading' | 'ready' | 'error' | 'unknown'>(
    'loading',
  );
  const [message, setMessage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [metaDirty, setMetaDirty] = useState(false);
  const [cloneDirty, setCloneDirty] = useState(false);
  const [clonedScope, setClonedScope] = useState<string | null>(null);
  const metaIntent = useIntentMutation<{ expectedRevision: number; name: string }>(tenantId, eventId, 'event.metadata');
  const cloneIntent = useIntentMutation<{ slug: string; name: string; copyConfig: boolean }>(tenantId, eventId, 'event.clone');
  const archiveIntent = useIntentMutation<{ expectedRevision: number }>(tenantId, eventId, 'event.archive');
  const metaDirtyRef = useRef(false);
  const cloneDirtyRef = useRef(false);
  useUnsavedChanges(
    hasUnsavedSetupChanges(metaDirty, cloneDirty),
    t('shell.unsaved.confirm'),
  );
  const [metaForm] = Form.useForm<{ name: string }>();
  const [cloneForm] = Form.useForm<{ slug: string; name: string }>();

  const load = useCallback(async () => {
    await Promise.resolve();
    setKind((current) => (current === 'ready' ? current : 'loading'));
    const res = await portalGet(bffEvent(tenantId, eventId));
    if (res.networkError || res.timedOut || res.status >= 500) {
      const failure = t('setup.h_1ygq73d');
      setKind((current) => (current === 'ready' ? current : 'unknown'));
      setNotice(failure);
      setMessage(failure);
      return;
    }
    if (res.status !== 200 || !res.json || typeof res.json !== 'object') {
      const failure = apiErrorMessage(
        res.json,
        t('common.httpStatus', { status: res.status }),
      );
      setKind((current) => (current === 'ready' ? current : 'error'));
      setNotice(failure);
      setMessage(failure);
      return;
    }
    const event = res.json as EventDetail;
    setDetail(event);
    applySetupReload(
      event,
      metaForm,
      cloneForm,
      { meta: metaDirtyRef.current, clone: cloneDirtyRef.current },
      t('common.cloneName', { name: event.name }),
    );
    setKind('ready');
  }, [tenantId, eventId, metaForm, cloneForm, t]);

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
        subTitle={t('config.h_g7fjbz')}
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
  if (!isEventPagePermitted('setup', access.permissions)) {
    return (
      <Result
        status="403"
        title={t(SURFACE_MESSAGE_KEYS.permissionTitle)}
        subTitle={t('config.h_g7fjbz')}
        extra={
          <Button type="primary" onClick={() => {
          window.location.href = `/t/${tenantId}/e/${eventId}`;
        }}>
            {t(SURFACE_MESSAGE_KEYS.permissionGoAllowed)}
          </Button>
        }
      />
    );
  }

  const canUpdate = canPerformEventAction('updateEvent', access.permissions);
  const blockedReasons = [metaIntent, cloneIntent, archiveIntent]
    .filter((intent) => intent.state === 'blocked')
    .map((intent) => intent.reason);
  const blockedReason = blockedReasons.includes('identity') ? 'identity' : blockedReasons[0] ?? null;
  const blockedPresentation = intentBlockPresentation(blockedReason);

  async function saveMeta() {
    if (!detail || busy || metaIntent.state === 'loading' || metaIntent.state === 'blocked') return;
    setBusy(true);
    setNotice(null);
    try {
      const values = await metaForm.validateFields();
      const payload = { expectedRevision: detail.revision, name: values.name.trim() };
      const outcome = await metaIntent.run(
        payload,
        (body) => portalMutate(bffEvent(tenantId, eventId), body, 'PATCH'),
        () => true,
      );
      if (outcome.kind === 'blocked') {
        setNotice(t(intentBlockMessageKey(outcome.reason)));
        return;
      }
      if (outcome.kind === 'unknown') {
        setNotice(t('setup.h_197dgrj'));
        return;
      }
      if (outcome.kind === 'confirmed') {
        if (metaForm.getFieldValue('name')?.trim() === payload.name) {
          metaDirtyRef.current = false;
          setMetaDirty(false);
        }
        setNotice(t('setup.h_1s3ht28'));
        void load();
        return;
      }
      setNotice(apiErrorMessage(outcome.response.json, t('setup.h_rezx8n')));
    } finally {
      setBusy(false);
    }
  }

  async function cloneEvent() {
    if (busy || clonedScope === `${tenantId}/${eventId}` || cloneIntent.state === 'loading' || cloneIntent.state === 'blocked') return;
    setBusy(true);
    setNotice(null);
    try {
      const values = await cloneForm.validateFields();
      const outcome = await cloneIntent.run(
        {
          slug: values.slug.trim(),
          name: values.name.trim(),
          copyConfig: true,
        },
        (body) => portalMutate(bffEventAction(tenantId, eventId, 'clone'), body),
        (res) => clonedEventId(res.json) !== null,
      );
      if (outcome.kind === 'blocked') {
        setNotice(t(intentBlockMessageKey(outcome.reason)));
        return;
      }
      if (outcome.kind === 'unknown') {
        setNotice(t('setup.h_mfkouj'));
        return;
      }
      const res = outcome.response;
      if (outcome.kind === 'confirmed') {
        const newId = clonedEventId(res.json);
        if (newId) {
          cloneDirtyRef.current = false;
          setCloneDirty(false);
          setNotice(t('setup.h_1sj85ay'));
          setClonedScope(`${tenantId}/${eventId}`);
          router.push(`/t/${tenantId}/e/${newId}`);
          return;
        }
        setNotice(t('setup.h_1okp02m'));
        return;
      }
      setNotice(apiErrorMessage(res.json, t('setup.h_1mfbkiv')));
    } finally {
      setBusy(false);
    }
  }

  function archiveEvent() {
    if (!detail || archiveIntent.state === 'loading' || archiveIntent.state === 'blocked') return;
    Modal.confirm({
      title: t('setup.h_4dggx3'),
      content: t('events.archive.hint'),
      okText: t('setup.h_1fmwr17'),
      okButtonProps: { danger: true },
      cancelText: t('config.huy'),
      onOk: async () => {
        const outcome = await archiveIntent.run(
          { expectedRevision: detail.revision },
          (body) => portalMutate(bffEventAction(tenantId, eventId, 'archive'), body),
          () => true,
        );
        if (outcome.kind === 'blocked') {
          setNotice(t(intentBlockMessageKey(outcome.reason)));
          return;
        }
        if (outcome.kind === 'unknown') {
          setNotice(t('setup.h_uafnux'));
          return;
        }
        if (outcome.kind === 'confirmed') {
          setNotice(t('setup.h_1dze9ux'));
          void load();
          return;
        }
        setNotice(apiErrorMessage(outcome.response.json, t('events.archive.failed')));
      },
    });
  }

  return (
    <PortalPage
      title={t('setup.title')}
      subTitle={t('setup.metadataHint')}
      loading={kind === 'loading'}
    >
      {kind === 'loading' ? (
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
  ) : null}
      {kind === 'unknown' ? (
        <Alert
          type="warning"
          showIcon
          message={t('surface.unknown.title')}
          description={message}
          action={
            <Button size="small" onClick={() => void load()}>
              {t('surface.action.recheck')}
            </Button>
          }
        />
      ) : null}
      {kind === 'error' ? (
        <Alert
        type="error"
        showIcon
        message={t(SURFACE_MESSAGE_KEYS.errorLoadFailed)}
        description={message}
        action={
          <Button size="small" onClick={() => void load()}>
            {t(SURFACE_MESSAGE_KEYS.retry)}
          </Button>
        }
        style={{ margin: 24 }}
      />
      ) : null}

      {kind === 'ready' && detail ? (
        <>
          {(metaIntent.state === 'blocked' || cloneIntent.state === 'blocked' || archiveIntent.state === 'blocked') ? (
            <Alert type="warning" showIcon message={t(blockedPresentation.title)}
              description={t(blockedPresentation.description)}
              action={<Button size="small" onClick={() => {
                if (blockedPresentation.reload) window.location.reload();
                else void load();
              }}>{t(blockedPresentation.action)}</Button>}
            />
          ) : null}
          <Alert
            type="info"
            showIcon
            message={`contentStatus=${detail.contentStatus} · businessStatus=${detail.businessStatus} · revision=${detail.revision}`}
          />

          <ProCard title={t('setup.h_y3j37s')} style={{ marginBottom: 16 }}>
            <ProForm
              onValuesChange={() => {
                metaDirtyRef.current = true;
                setMetaDirty(true);
              }}
              form={metaForm}
              layout="inline"
              disabled={!canUpdate || busy || metaIntent.state === 'loading' || metaIntent.state === 'blocked'}
              submitter={{
                searchConfig: { submitText: t('setup.luu') },
                 submitButtonProps: { disabled: !canUpdate || metaIntent.state === 'loading' || metaIntent.state === 'blocked', loading: busy },
              }}
              onFinish={() => void saveMeta()}
            >
              <ProFormText
                name="name"
                rules={[{ required: true }]}
                width={320}
                disabled={metaIntent.state === 'unknown' || metaIntent.state === 'blocked'}
              />
            </ProForm>
          </ProCard>

          <ProCard title="Clone" style={{ marginBottom: 16 }}>
            <ProForm
              onValuesChange={() => {
                cloneDirtyRef.current = true;
                setCloneDirty(true);
              }}
              form={cloneForm}
              layout="vertical"
              disabled={!canUpdate || busy || clonedScope === `${tenantId}/${eventId}` || cloneIntent.state === 'loading' || cloneIntent.state === 'blocked'}
              style={{ maxWidth: 420 }}
              submitter={{
                searchConfig: { submitText: t('setup.h_1iam0zn') },
                submitButtonProps: { disabled: !canUpdate || clonedScope === `${tenantId}/${eventId}` || cloneIntent.state === 'loading' || cloneIntent.state === 'blocked', loading: busy },
              }}
              onFinish={() => void cloneEvent()}
            >
              <ProFormText
                name="name"
                label={t('setup.h_1ps26zd')}
                rules={[{ required: true }]}
              />
              <ProFormText
                name="slug"
                label={t('setup.h_1mbcc7c')}
                rules={[{ required: true }]}
              />
            </ProForm>
          </ProCard>

          <ProCard title={t('setup.h_1fmwr17')}>
            <Button
              danger
              disabled={!canUpdate || detail.contentStatus === 'ARCHIVED' || archiveIntent.state === 'loading' || archiveIntent.state === 'blocked'}
              onClick={() => archiveEvent()}
            >
              Archive
            </Button>
          </ProCard>
        </>
      ) : null}

      {kind === 'ready' && notice ? (
        <Alert type={metaIntent.state === 'unknown' || cloneIntent.state === 'unknown' || archiveIntent.state === 'unknown' || metaIntent.state === 'blocked' || cloneIntent.state === 'blocked' || archiveIntent.state === 'blocked' ? 'warning' : 'info'} showIcon message={notice} />
      ) : null}
    </PortalPage>
  );
}
