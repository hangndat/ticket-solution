'use client';

import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Space,
  Typography,
} from 'antd';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { EventDetail } from '@ticket/contracts';
import {
  apiErrorMessage,
  portalGet,
  portalMutate,
} from '../../../../../../src/client/portal-fetch';
import { bffEvent, bffEventAction } from '../../../../../../src/prep/bff-urls';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { SurfaceState } from '../../../../../../src/components/surface-state';
import { usePortalLocale } from '../../../../../../src/i18n';

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
  const [metaForm] = Form.useForm<{ name: string }>();
  const [cloneForm] = Form.useForm<{ slug: string; name: string }>();

  const load = useCallback(async () => {
    await Promise.resolve();
    setKind('loading');
    const res = await portalGet(bffEvent(tenantId, eventId));
    if (res.networkError || res.timedOut || res.status >= 500) {
      setKind('unknown');
      setMessage(t('setup.h_1ygq73d'));
      return;
    }
    if (res.status !== 200 || !res.json || typeof res.json !== 'object') {
      setKind('error');
      setMessage(apiErrorMessage(res.json, t('common.httpStatus', { status: res.status })));
      return;
    }
    const event = res.json as EventDetail;
    setDetail(event);
    metaForm.setFieldsValue({ name: event.name });
    cloneForm.setFieldsValue({
      slug: `${event.slug}-copy`,
      name: t('common.cloneName', { name: event.name }),
    });
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

  const canUpdate = access.permissions.includes('event.update');

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
      content:
        t('events.archive.hint'),
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
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>{t('setup.title')}</Typography.Title>
      <Typography.Paragraph type="secondary">
        {t('setup.metadataHint')}
      </Typography.Paragraph>

      {kind === 'loading' ? <SurfaceState kind="loading" /> : null}
      {kind === 'unknown' ? (
        <Alert
          type="warning"
          showIcon
          message={t('surface.unknown.title')}
          description={message}
          action={
            <Button size="small" onClick={() => void load()}>{t('surface.action.recheck')}</Button>
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

          <Typography.Title level={5}>{t('setup.h_y3j37s')}</Typography.Title>
          <Form form={metaForm} layout="inline" disabled={!canUpdate || busy}>
            <Form.Item name="name" rules={[{ required: true }]}>
              <Input style={{ width: 320 }} />
            </Form.Item>
            <Button
              type="primary"
              disabled={!canUpdate}
              loading={busy}
              onClick={() => void saveMeta()}
            >{t('setup.luu')}</Button>
          </Form>

          <Typography.Title level={5}>Clone</Typography.Title>
          <Form form={cloneForm} layout="vertical" style={{ maxWidth: 420 }}>
            <Form.Item name="name" label={t('setup.h_1ps26zd')} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="slug" label={t('setup.h_1mbcc7c')} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Button
              disabled={!canUpdate}
              loading={busy}
              onClick={() => void cloneEvent()}
            >{t('setup.h_1iam0zn')}</Button>
          </Form>

          <Typography.Title level={5}>{t('setup.h_1fmwr17')}</Typography.Title>
          <Button
            danger
            disabled={!canUpdate || detail.contentStatus === 'ARCHIVED'}
            onClick={() => archiveEvent()}
          >
            Archive
          </Button>
        </>
      ) : null}

      {notice ? <Alert type="info" showIcon message={notice} /> : null}
    </Space>
  );
}
