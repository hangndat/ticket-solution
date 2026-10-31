'use client';

import { ProForm, ProFormText } from '@ant-design/pro-components';
import { Alert, Button, Flex, Form, Result, Spin, Typography } from 'antd';
import { PortalPage } from '../../../../src/components/portal-page';
import { useParams } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { useActorState as useState } from '../../../../src/client/use-actor-state';
import {
  apiErrorMessage,
  portalGet,
  portalMutate,
} from '../../../../src/client/portal-fetch';
import { bffBranding } from '../../../../src/prep/bff-urls';
import { TenantLimitsCard } from '../../../../src/components/tenant-limits-card';
import { useTenantAccess } from '../../../../src/prep/use-event-access';
import { canPerformTenantAction } from '../../../../src/nav/capability-policy';
import { usePortalLocale } from '../../../../src/i18n';
import { SURFACE_MESSAGE_KEYS } from '../../../../src/prep/surface-copy';
import { useUnsavedChanges } from '../../../../src/nav/unsaved-changes';

type Branding = {
  displayName: string;
  primaryColor: string;
  secondaryColor: string | null;
  version: number;
};

export default function OrgSettingsPage() {
  const { t } = usePortalLocale();
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
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty, t('shell.unsaved.confirm'));
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
      setMessage(t('settings.h_k2xz80'));
      return;
    }
    if (res.status !== 200 || !res.json || typeof res.json !== 'object') {
      setKind('error');
      setMessage(
        apiErrorMessage(
          res.json,
          t('common.httpStatus', { status: res.status }),
        ),
      );
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
  }, [tenantId, form, t]);

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
  if (
    !canPerformTenantAction('editSettings', access.tenant.tenantPermissions)
  ) {
    return (
      <Result
        status="403"
        title={t(SURFACE_MESSAGE_KEYS.permissionTitle)}
        subTitle={t('settings.h_ch34ez')}
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
  if (suspended) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('settings.h_6boshw')}
        description={t('settings.h_i7x4fp')}
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
        setNotice(t('settings.h_1rjs2jo'));
        return;
      }
      if (res.status === 200) {
        setDirty(false);
        setNotice(t('settings.h_17g3cj6'));
        void load();
        return;
      }
      setNotice(
        apiErrorMessage(
          res.json,
          t('settings.saveFailedHttp', { status: res.status }),
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalPage title={t('settings.orgTitle')} loading={kind === 'loading'}>
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
          <TenantLimitsCard tenantId={tenantId} />
          <ProForm
            form={form}
            onValuesChange={() => setDirty(true)}
            layout="vertical"
            style={{ maxWidth: 480 }}
            submitter={{
              searchConfig: { submitText: t('setup.luu') },
              submitButtonProps: { loading: busy },
            }}
            onFinish={() => void save()}
          >
            <ProFormText
              name="displayName"
              label={t('settings.h_448wq6')}
              rules={[{ required: true }]}
            />
            <ProFormText
              name="primaryColor"
              label={t('config.h_1fbsj7r')}
              rules={[{ required: true }]}
              fieldProps={{ placeholder: '#9b3a18' }}
            />
            <ProFormText name="secondaryColor" label={t('settings.h_me7m5c')} />
            <Typography.Text type="secondary">
              {t('settings.currentVersion')}
              {branding?.version ?? '—'}
            </Typography.Text>
          </ProForm>
          {notice ? <Alert type="info" showIcon message={notice} /> : null}
        </>
      ) : null}
    </PortalPage>
  );
}
