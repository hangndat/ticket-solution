'use client';

import {
  ProForm,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, Button, Flex, Form, Modal, Result, Space, Spin, Typography } from 'antd';
import { PortalPage } from '../../../../../../src/components/portal-page';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type {
  ConfigPreviewResponse,
  ConfigVersionSummary,
  EventDetail,
} from '@ticket/contracts';
import {
  apiErrorCode,
  apiErrorMessage,
  portalGet,
  portalMutate,
} from '../../../../../../src/client/portal-fetch';
import {
  configFields,
  configSaveNoticeKey,
  hasConfigVersionConflict,
  isConfigPreview,
  mergeConfigFields,
  type ConfigFields,
} from '../../../../../../src/prep/config-editor';
import {
  buildMinimalConfigPayload,
  hasTermsContent,
  isMinimalBrandOk,
} from '../../../../../../src/prep/default-config';
import { bffEvent, bffEventAction } from '../../../../../../src/prep/bff-urls';
import { isEventPagePermitted } from '../../../../../../src/prep/event-access-resolver';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { canPerformEventAction } from '../../../../../../src/nav/capability-policy';
import { usePortalLocale } from '../../../../../../src/i18n';
import { SURFACE_MESSAGE_KEYS } from '../../../../../../src/prep/surface-copy';
import { useUnsavedChanges } from '../../../../../../src/nav/unsaved-changes';

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
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty, t('shell.unsaved.confirm'));
  const [baseConfig, setBaseConfig] = useState<{
    version: number | null;
    payload: ConfigPreviewResponse['payload'] | null;
    fields: ConfigFields;
  } | null>(null);
  const [selectedPreview, setSelectedPreview] =
    useState<ConfigPreviewResponse | null>(null);
  const [conflict, setConflict] = useState(false);
  const [form] = Form.useForm<ConfigFields>();

  const configVersionsUrl = bffEventAction(
    tenantId,
    eventId,
    'config-versions',
  );

  const load = useCallback(
    async (previewVersion?: number) => {
      await Promise.resolve();
      setKind('loading');
      setBaseConfig(null);
      setConflict(false);
      const [c, d] = await Promise.all([
        portalGet(configVersionsUrl),
        portalGet(bffEvent(tenantId, eventId)),
      ]);
      if (c.networkError || c.timedOut || c.status >= 500) {
        setKind('unknown');
        setMessage(t('config.h_194o8da'));
        return { loaded: false, latestVersion: undefined };
      }
      if (c.status !== 200 || !c.json || typeof c.json !== 'object') {
        setKind('error');
        setMessage(
          apiErrorMessage(c.json, t('common.httpStatus', { status: c.status })),
        );
        return { loaded: false, latestVersion: undefined };
      }
      const items = Array.isArray((c.json as { items?: unknown }).items)
        ? ((c.json as { items: ConfigVersionSummary[] })
            .items as ConfigVersionSummary[])
        : [];
      setVersions(items);
      if (d.status === 200 && d.json && typeof d.json === 'object') {
        setDetail(d.json as EventDetail);
      }

      const tip = items[0];
      if (tip) {
        const preview = await portalGet(
          `${configVersionsUrl}/${tip.version}/preview`,
        );
        if (
          preview.status !== 200 ||
          !isConfigPreview(preview.json, tip.version)
        ) {
          setKind('error');
          setMessage(t('config.previewLoadFailed'));
          return { loaded: false, latestVersion: tip.version };
        }
        const fields = configFields(preview.json.payload);
        setBaseConfig({
          version: tip.version,
          payload: preview.json.payload,
          fields,
        });
        form.setFieldsValue(fields);
        if (previewVersion != null && previewVersion !== tip.version) {
          const saved = await portalGet(
            `${configVersionsUrl}/${previewVersion}/preview`,
          );
          if (
            saved.status !== 200 ||
            !isConfigPreview(saved.json, previewVersion)
          ) {
            setSelectedPreview(null);
            setKind('ready');
            return { loaded: false, latestVersion: tip.version };
          }
          setSelectedPreview(saved.json);
        } else {
          setSelectedPreview(preview.json);
        }
      } else {
        const fields = {
          organizationName: '',
          primaryColor: '#9b3a18',
          termsText: '',
        };
        setBaseConfig({ version: null, payload: null, fields });
        setSelectedPreview(null);
        form.setFieldsValue(fields);
      }
      setKind('ready');
      return { loaded: true, latestVersion: tip?.version ?? null };
    },
    [tenantId, eventId, form, t, configVersionsUrl],
  );

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
  if (!isEventPagePermitted('config', access.permissions)) {
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

  const canConfig = canPerformEventAction('saveConfig', access.permissions);
  const publishedVersion = versions.find((v) => v.published)?.version ?? null;

  async function saveDraft() {
    setBusy(true);
    setNotice(null);
    try {
      const values = await form.validateFields();
      if (!baseConfig) return;
      const latest = await portalGet(configVersionsUrl);
      if (
        latest.networkError ||
        latest.timedOut ||
        latest.status !== 200 ||
        !latest.json ||
        typeof latest.json !== 'object' ||
        !Array.isArray((latest.json as { items?: unknown }).items)
      ) {
        setNotice(t('config.latestCheckFailed'));
        return;
      }
      const latestVersion =
        (latest.json as { items: ConfigVersionSummary[] }).items[0]?.version ??
        null;
      if (hasConfigVersionConflict(baseConfig.version, latestVersion)) {
        setConflict(true);
        return;
      }
      const payload = baseConfig.payload
        ? mergeConfigFields(baseConfig.payload, baseConfig.fields, values)
        : buildMinimalConfigPayload(values);
      if (!isMinimalBrandOk(payload) || !hasTermsContent(payload)) {
        setNotice(t('config.h_ve7ob6'));
        return;
      }
      const res = await portalMutate(configVersionsUrl, {
        payload,
        schemaVersion: payload.schemaVersion,
        expectedVersion: baseConfig.version ?? 0,
      });
      if (res.networkError || res.timedOut || res.status >= 500) {
        setNotice(t('config.h_1irt9z3'));
        return;
      }
      if (res.status >= 200 && res.status < 300) {
        setDirty(false);
        const savedVersion = (res.json as { version?: unknown } | null)
          ?.version;
        const loaded = await load(
          typeof savedVersion === 'number' ? savedVersion : undefined,
        );
        setNotice(
          t(
            configSaveNoticeKey(
              typeof savedVersion === 'number' ? savedVersion : undefined,
              loaded.latestVersion,
              loaded.loaded,
            ),
          ),
        );
        if (typeof savedVersion !== 'number') setSelectedPreview(null);
        return;
      }
      if (
        res.status === 409 &&
        ['REVISION_CONFLICT', 'CONFIG_VERSION_MISMATCH'].includes(
          apiErrorCode(res.json) ?? '',
        )
      ) {
        setConflict(true);
        return;
      }
      setNotice(apiErrorMessage(res.json, t('config.h_13x41d8')));
    } finally {
      setBusy(false);
    }
  }

  async function showPreview(version: number) {
    const response = await portalGet(`${configVersionsUrl}/${version}/preview`);
    if (response.status !== 200 || !isConfigPreview(response.json, version)) {
      setNotice(t('config.previewLoadFailed'));
      return;
    }
    setSelectedPreview(response.json);
    setNotice(null);
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
      content: t('config.h_1djtg5w'),
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
    <PortalPage
      title={t('settings.brandPublishTitle')}
      subTitle={t('config.h_bji8yr')}
    >
      <Alert
        type="info"
        showIcon
        message={t('config.h_gyyhq3')}
        style={{ marginBottom: 16 }}
      />

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

      {kind === 'ready' ? (
        <>
          <ProForm
            form={form}
            onValuesChange={() => setDirty(true)}
            layout="vertical"
            style={{ maxWidth: 480 }}
            disabled={!canConfig}
            submitter={false}
          >
            <ProFormText
              name="organizationName"
              label={t('config.h_15mcx85')}
              rules={[{ required: true }]}
            />
            <ProFormText
              name="primaryColor"
              label={t('config.h_1fbsj7r')}
              rules={[
                { required: true },
                {
                  pattern: /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/,
                  message: t('config.invalidColor'),
                },
              ]}
              fieldProps={{ placeholder: '#9b3a18' }}
            />
            <ProFormTextArea
              name="termsText"
              label={t('config.h_6ccvfx')}
              rules={[{ required: true }]}
              fieldProps={{ rows: 4 }}
            />
            <Space>
              <Button
                type="primary"
                loading={busy}
                disabled={!canConfig || conflict || !baseConfig}
                onClick={() => void saveDraft()}
              >
                {t('config.h_q8yg9j')}
              </Button>
              <Button
                disabled={
                  !canPerformEventAction('publishConfig', access.permissions)
                }
                onClick={() => void publishTip()}
              >
                {t('config.h_19gwi7d')}
              </Button>
            </Space>
          </ProForm>

          {conflict ? (
            <Alert
              type="warning"
              showIcon
              message={t('config.versionConflict')}
              description={t('config.reloadDiscard')}
              action={
                <Button onClick={() => void load()}>
                  {t('config.reloadLatest')}
                </Button>
              }
              style={{ marginTop: 16 }}
            />
          ) : null}

          {selectedPreview ? (
            <section
              aria-label={t('config.previewTitle', {
                version: selectedPreview.version,
              })}
              style={{
                border: '1px solid #d9d9d9',
                borderRadius: 8,
                padding: 16,
                marginTop: 24,
              }}
            >
              <Typography.Title level={5}>
                {t('config.previewTitle', { version: selectedPreview.version })}
              </Typography.Title>
              <Typography.Paragraph>
                <span
                  aria-hidden="true"
                  style={{
                    backgroundColor: selectedPreview.payload.brand.primaryColor,
                    display: 'inline-block',
                    width: 14,
                    height: 14,
                    marginRight: 8,
                    verticalAlign: 'middle',
                  }}
                />
                {selectedPreview.payload.brand.organizationName}
              </Typography.Paragraph>
              <Typography.Paragraph>
                {t('config.previewSections', {
                  count: selectedPreview.payload.sections.filter(
                    (section) => section.visible,
                  ).length,
                })}
              </Typography.Paragraph>
              {selectedPreview.payload.sections
                .filter((section) => section.visible)
                .sort((a, b) => a.order - b.order)
                .map((section) => (
                  <div key={section.id}>
                    <Typography.Title level={5}>
                      {typeof section.body.title === 'string'
                        ? section.body.title
                        : section.kind}
                    </Typography.Title>
                    {typeof section.body.text === 'string' ? (
                      <Typography.Paragraph>
                        {section.body.text}
                      </Typography.Paragraph>
                    ) : null}
                    {section.kind === 'faq' && Array.isArray(section.body.items)
                      ? section.body.items.map((item, index) => {
                          if (!item || typeof item !== 'object') return null;
                          const faq = item as {
                            question?: unknown;
                            answer?: unknown;
                          };
                          return typeof faq.question === 'string' &&
                            typeof faq.answer === 'string' ? (
                            <Typography.Paragraph key={index}>
                              <strong>{faq.question}</strong> {faq.answer}
                            </Typography.Paragraph>
                          ) : null;
                        })
                      : null}
                  </div>
                ))}
            </section>
          ) : null}

          <Typography.Title level={5}>{t('config.h_qavzgt')}</Typography.Title>
          <ProTable<ConfigVersionSummary>
            rowKey="version"
            dataSource={versions}
            search={false}
            options={false}
            pagination={false}
            columns={[
              { title: 'Version', dataIndex: 'version' },
              {
                title: 'Published',
                dataIndex: 'published',
                render: (_, row) => (row.published ? 'yes' : 'no'),
              },
              { title: t('config.h_1c1wh3g'), dataIndex: 'createdAt' },
              {
                title: t('config.previewAction'),
                render: (_: unknown, row: ConfigVersionSummary) => (
                  <Button
                    size="small"
                    onClick={() => void showPreview(row.version)}
                  >
                    {t('config.previewAction')}
                  </Button>
                ),
              },
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
                      {t('config.h_wotjs8')}
                    </Button>
                  ) : null,
              },
            ]}
          />
        </>
      ) : null}

      {notice ? <Alert type="info" showIcon message={notice} /> : null}
    </PortalPage>
  );
}
