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
import { usePortalLocale } from '../../../../../../src/i18n';

export default function ConfigBrandPage() {
  const { t } = usePortalLocale();
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
      setMessage(t('config.h_194o8da'));
      return;
    }
    if (c.status !== 200 || !c.json || typeof c.json !== 'object') {
      setKind('error');
      setMessage(apiErrorMessage(c.json, t('common.httpStatus', { status: c.status })));
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
  }, [tenantId, eventId, form, t]);

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
        setNotice(t('config.h_ve7ob6'));
        return;
      }
      const res = await portalMutate(
        bffEventAction(tenantId, eventId, 'config-versions'),
        { payload, schemaVersion: 1 },
      );
      if (res.networkError || res.timedOut || res.status >= 500) {
        setNotice(t('config.h_1irt9z3'));
        return;
      }
      if (res.status >= 200 && res.status < 300) {
        setNotice(t('config.h_1qavkda'));
        void load();
        return;
      }
      setNotice(apiErrorMessage(res.json, t('config.h_13x41d8')));
    } finally {
      setBusy(false);
    }
  }

  async function publishTip() {
    const tip = versions[0];
    if (!tip) {
      setNotice(t('config.h_1ylm4kq'));
      return;
    }
    Modal.confirm({
      title: t('config.h_14ib82o'),
      content: (
        <Alert
          type="warning"
          showIcon
          message={t('config.h_1hh7j6r')}
          description={t('config.publishConfirm', { version: tip.version })}
        />
      ),
      okText: t('config.h_lofnqs'),
      cancelText: t('config.huy'),
      onOk: async () => {
        const res = await portalMutate(
          bffEventAction(tenantId, eventId, 'publish'),
          { expectedVersion: tip.version },
        );
        if (res.networkError || res.status >= 500) {
          setNotice(t('config.h_1b1xmvu'));
          return;
        }
        if (res.status >= 200 && res.status < 300) {
          setNotice(t('config.h_1ec27qs'));
          void load();
          return;
        }
        setNotice(apiErrorMessage(res.json, t('config.h_ez5uf1')));
      },
    });
  }

  function rollbackTo(targetVersion: number) {
    if (!detail || publishedVersion == null) {
      setNotice(t('config.h_1eg9ac0'));
      return;
    }
    Modal.confirm({
      title: t('config.rollbackConfirm', { targetVersion }),
      content:
        t('config.h_1djtg5w'),
      okText: 'Rollback',
      okButtonProps: { danger: true },
      cancelText: t('config.huy'),
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
          setNotice(t('config.h_1xteu8h'));
          return;
        }
        if (res.status >= 200 && res.status < 300) {
          setNotice(t('config.h_145079h'));
          void load();
          return;
        }
        setNotice(apiErrorMessage(res.json, t('config.h_14tzacc')));
      },
    });
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>{t('settings.brandPublishTitle')}</Typography.Title>
      <Alert
        type="info"
        showIcon
        message={t('config.h_gyyhq3')}
        description={t('config.h_bji8yr')}
      />

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

      {kind === 'ready' ? (
        <>
          <Form form={form} layout="vertical" style={{ maxWidth: 480 }} disabled={!canConfig}>
            <Form.Item
              name="organizationName"
              label={t('config.h_15mcx85')}
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="primaryColor"
              label={t('config.h_1fbsj7r')}
              rules={[{ required: true }]}
            >
              <Input placeholder="#9b3a18" />
            </Form.Item>
            <Form.Item
              name="termsText"
              label={t('config.h_6ccvfx')}
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
              >{t('config.h_q8yg9j')}</Button>
              <Button
                disabled={!canConfig || !access.permissions.includes('config.publish')}
                onClick={() => void publishTip()}
              >{t('config.h_19gwi7d')}</Button>
            </Space>
          </Form>

          <Typography.Title level={5}>{t('config.h_qavzgt')}</Typography.Title>
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
              { title: t('config.h_1c1wh3g'), dataIndex: 'createdAt' },
              {
                title: '',
                render: (_: unknown, row: ConfigVersionSummary) =>
                  !row.published && publishedVersion != null ? (
                    <Button
                      size="small"
                      danger
                      disabled={!canConfig}
                      onClick={() => rollbackTo(row.version)}
                    >{t('config.h_wotjs8')}</Button>
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
