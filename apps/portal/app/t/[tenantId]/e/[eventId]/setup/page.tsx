'use client';

import { ProCard, ProForm, ProFormText } from '@ant-design/pro-components';
import { Alert, Button, Form, Modal } from 'antd';
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
import { SurfaceState } from '../../../../../../src/components/surface-state';
import { usePortalLocale } from '../../../../../../src/i18n';
import { useUnsavedChanges } from '../../../../../../src/nav/unsaved-changes';
import {
  applySetupReload,
  hasUnsavedSetupChanges,
} from '../../../../../../src/setup/setup-drafts';

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
        description={t('config.h_g7fjbz')}
        onRetry={() => {
          window.location.href = `/t/${tenantId}`;
        }}
      />
    );
  }
  if (!isEventPagePermitted('setup', access.permissions)) {
    return (
      <SurfaceState
        kind="permission-denied"
        description={t('config.h_g7fjbz')}
        onRetry={() => {
          window.location.href = `/t/${tenantId}/e/${eventId}`;
        }}
      />
    );
  }

  const canUpdate = canPerformEventAction('updateEvent', access.permissions);

  async function saveMeta() {
    if (!detail) return;
    setBusy(true);
    setNotice(null);
    try {
      const values = await metaForm.validateFields();
      const res = await portalMutate(
        bffEvent(tenantId, eventId),
        {
          expectedRevision: detail.revision,
          name: values.name.trim(),
        },
        'PATCH',
      );
      if (res.networkError || res.timedOut || res.status >= 500) {
        setNotice(t('setup.h_197dgrj'));
        return;
      }
      if (res.status >= 200 && res.status < 300) {
        metaDirtyRef.current = false;
        setMetaDirty(false);
        setNotice(t('setup.h_1s3ht28'));
        void load();
        return;
      }
      setNotice(apiErrorMessage(res.json, t('setup.h_rezx8n')));
    } finally {
      setBusy(false);
    }
  }

  async function cloneEvent() {
    setBusy(true);
    setNotice(null);
    try {
      const values = await cloneForm.validateFields();
      const res = await portalMutate(
        bffEventAction(tenantId, eventId, 'clone'),
        {
          slug: values.slug.trim(),
          name: values.name.trim(),
          copyConfig: true,
          idempotencyKey: crypto.randomUUID(),
        },
      );
      if (res.networkError || res.timedOut || res.status >= 500) {
        setNotice(t('setup.h_mfkouj'));
        return;
      }
      if (res.status >= 200 && res.status < 300) {
        const newId =
          res.json &&
          typeof res.json === 'object' &&
          typeof (res.json as { eventId?: unknown }).eventId === 'string'
            ? ((res.json as { eventId: string }).eventId as string)
            : null;
        if (newId) {
          cloneDirtyRef.current = false;
          setCloneDirty(false);
          setNotice(t('setup.h_1sj85ay'));
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
    if (!detail) return;
    Modal.confirm({
      title: t('setup.h_4dggx3'),
      content: t('events.archive.hint'),
      okText: t('setup.h_1fmwr17'),
      okButtonProps: { danger: true },
      cancelText: t('config.huy'),
      onOk: async () => {
        const res = await portalMutate(
          bffEventAction(tenantId, eventId, 'archive'),
          {
            expectedRevision: detail.revision,
            idempotencyKey: crypto.randomUUID(),
          },
        );
        if (res.networkError || res.status >= 500) {
          setNotice(t('setup.h_uafnux'));
          return;
        }
        if (res.status >= 200 && res.status < 300) {
          setNotice(t('setup.h_1dze9ux'));
          void load();
          return;
        }
        setNotice(apiErrorMessage(res.json, t('events.archive.failed')));
      },
    });
  }

  return (
    <PortalPage
      title={t('setup.title')}
      subTitle={t('setup.metadataHint')}
      loading={kind === 'loading'}
    >
      {kind === 'loading' ? <SurfaceState kind="loading" /> : null}
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
        <SurfaceState
          kind="error"
          description={message}
          onRetry={() => void load()}
        />
      ) : null}

      {kind === 'ready' && detail ? (
        <>
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
              disabled={!canUpdate || busy}
              submitter={{
                searchConfig: { submitText: t('setup.luu') },
                submitButtonProps: { disabled: !canUpdate, loading: busy },
              }}
              onFinish={() => void saveMeta()}
            >
              <ProFormText
                name="name"
                rules={[{ required: true }]}
                width={320}
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
              style={{ maxWidth: 420 }}
              submitter={{
                searchConfig: { submitText: t('setup.h_1iam0zn') },
                submitButtonProps: { disabled: !canUpdate, loading: busy },
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
              disabled={!canUpdate || detail.contentStatus === 'ARCHIVED'}
              onClick={() => archiveEvent()}
            >
              Archive
            </Button>
          </ProCard>
        </>
      ) : null}

      {kind === 'ready' && notice ? (
        <Alert type="info" showIcon message={notice} />
      ) : null}
    </PortalPage>
  );
}
