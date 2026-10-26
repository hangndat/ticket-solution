'use client';

import { ProForm, ProFormText } from '@ant-design/pro-components';
import { Alert, Button, Form, Typography } from 'antd';
import { PortalPage } from '../../../../src/components/portal-page';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  apiErrorMessage,
  portalGet,
  portalMutate,
} from '../../../../src/client/portal-fetch';
import { bffBranding } from '../../../../src/prep/bff-urls';
import { useTenantAccess } from '../../../../src/prep/use-event-access';
import { canPerformTenantAction } from '../../../../src/nav/capability-policy';
import { SurfaceState } from '../../../../src/components/surface-state';
import { usePortalLocale } from '../../../../src/i18n';

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
  if (
    !canPerformTenantAction('editSettings', access.tenant.tenantPermissions)
  ) {
    return (
      <SurfaceState
        kind="permission-denied"
        description={t('settings.h_ch34ez')}
        onRetry={() => {
          window.location.href = `/t/${tenantId}`;
        }}
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
      {kind === 'ready' ? (
        <>
          <ProForm
            form={form}
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
