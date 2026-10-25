'use client';

import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Result,
  Select,
  Space,
  Steps,
  Typography,
} from 'antd';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MeTenantItem, RolePresetDto } from '@ticket/contracts';
import {
  apiErrorCode,
  apiErrorMessage,
  portalGet,
  portalMutate,
} from '../../../src/client/portal-fetch';
import { SurfaceState } from '../../../src/components/surface-state';
import { usePortalLocale } from '../../../src/i18n';
import { loadShellContext } from '../../../src/nav/load-shell-context';
import { DEFAULT_TENANT_PRIMARY_COLOR } from '../../../src/theme/vemoki';
import {
  firstRunCurrentStep,
  isPendingActivationStatus,
  patchOnboardingProgress,
  readOnboardingProgress,
  shouldShowFirstRun,
  type OnboardingProgress,
} from '../../../src/onboarding';
import {
  bffBranding,
  bffInvites,
  bffRolePresets,
} from '../../../src/prep/bff-urls';
import { usePortalUserId } from '../../../src/views/use-portal-user-id';

type Branding = {
  displayName: string;
  primaryColor: string;
  secondaryColor: string | null;
  version: number;
};

type PageMode =
  | { kind: 'loading' }
  | { kind: 'error'; message?: string }
  | { kind: 'denied'; reason?: 'attendee' }
  | { kind: 'pending'; tenant: MeTenantItem }
  | {
      kind: 'first-run';
      tenant: MeTenantItem;
      progress: OnboardingProgress;
      events: { eventId: string; name: string }[];
    }
  | { kind: 'done'; tenantId: string };

/**
 * /onboarding/[tenantId]
 * PENDING → Result chờ kích hoạt (không admin mutation / không first-run ACTIVE).
 * ACTIVE → Steps org → Manager invite (preset) → event DRAFT → readiness.
 */
export default function TenantOnboardingPage() {
  const { t } = usePortalLocale();
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const identity = usePortalUserId();
  const userId = identity.status === 'ready' ? identity.userId : null;

  const [mode, setMode] = useState<PageMode>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [presets, setPresets] = useState<RolePresetDto[]>([]);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [orgForm] = Form.useForm<{ displayName: string; primaryColor: string }>();
  const [inviteForm] = Form.useForm<{
    email: string;
    roleKey: string;
  }>();

  const reload = useCallback(async () => {
    setMode({ kind: 'loading' });
    setNotice(null);
    const shell = await loadShellContext();
    if (shell.status === 'unauthenticated') {
      window.location.href = `/api/auth/login?return=/onboarding/${tenantId}`;
      return;
    }
    if (shell.status === 'error') {
      setMode({
        kind: 'error',
        message: shell.messageKey ? t(shell.messageKey) : undefined,
      });
      return;
    }
    if (shell.status !== 'ready') return;

    const tenant =
      shell.meTenants?.items.find((item) => item.tenantId === tenantId) ?? null;
    if (!tenant) {
      setMode({ kind: 'denied' });
      return;
    }
    if (tenant.role === 'Attendee') {
      setMode({ kind: 'denied', reason: 'attendee' });
      return;
    }

    if (isPendingActivationStatus(tenant.status)) {
      setMode({ kind: 'pending', tenant });
      return;
    }

    if (tenant.status === 'SUSPENDED') {
      setMode({ kind: 'error', message: t('surface.suspended.description') });
      return;
    }

    const events =
      shell.meEvents?.items
        .filter((e) => e.tenantId === tenantId)
        .map((e) => ({ eventId: e.eventId, name: e.name })) ?? [];
    const progress = readOnboardingProgress(userId, tenantId);
    const hasEvent = events.length > 0;

    if (
      !shouldShowFirstRun({
        tenantStatus: tenant.status,
        progress,
        hasEvent,
      })
    ) {
      setMode({ kind: 'done', tenantId });
      window.location.replace(`/t/${tenantId}`);
      return;
    }

    setMode({ kind: 'first-run', tenant, progress, events });
  }, [tenantId, userId, t]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void reload();
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    if (mode.kind !== 'first-run' || !userId) return;
    let cancelled = false;
    void (async () => {
      const [brandRes, presetRes] = await Promise.all([
        portalGet(bffBranding(tenantId)),
        portalGet(bffRolePresets(tenantId)),
      ]);
      if (cancelled) return;
      if (brandRes.status === 200 && brandRes.json && typeof brandRes.json === 'object') {
        const b = brandRes.json as Branding;
        setBranding(b);
        orgForm.setFieldsValue({
          displayName: b.displayName,
          primaryColor: b.primaryColor || DEFAULT_TENANT_PRIMARY_COLOR,
        });
      }
      if (
        presetRes.status === 200 &&
        presetRes.json &&
        typeof presetRes.json === 'object'
      ) {
        const items = (presetRes.json as { items?: unknown }).items;
        if (Array.isArray(items)) {
          setPresets(items as RolePresetDto[]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode.kind, tenantId, userId, orgForm]);

  const roleOptions = useMemo(() => {
    const builtIn = [
      { value: 'role:Manager', label: t('onboarding.firstRun.roleManager') },
    ];
    const fromPresets = presets.map((p) => ({
      value: `preset:${p.presetId}`,
      label: p.name,
    }));
    return [...builtIn, ...fromPresets];
  }, [presets, t]);

  async function saveOrg() {
    if (!userId || mode.kind !== 'first-run') return;
    setBusy(true);
    setNotice(null);
    try {
      const values = await orgForm.validateFields();
      if (!branding) {
        // Branding unavailable — still allow progress (display name from discovery).
        patchOnboardingProgress(userId, tenantId, { orgDone: true });
        void reload();
        return;
      }
      const res = await portalMutate(
        bffBranding(tenantId),
        {
          displayName: values.displayName.trim(),
          primaryColor: values.primaryColor.trim(),
          expectedVersion: branding.version,
        },
        'PUT',
      );
      if (res.networkError || res.timedOut || res.status >= 500) {
        setNotice(t('onboarding.firstRun.orgUnknown'));
        return;
      }
      if (res.status === 403) {
        const code = apiErrorCode(res.json);
        if (code === 'TENANT_PENDING') {
          setNotice(t('onboarding.pending.mutationBlocked'));
          void reload();
          return;
        }
        setNotice(apiErrorMessage(res.json, t('onboarding.firstRun.orgDenied')));
        return;
      }
      if (res.status < 200 || res.status >= 300) {
        setNotice(
          apiErrorMessage(res.json, t('settings.saveFailedHttp', { status: res.status })),
        );
        return;
      }
      patchOnboardingProgress(userId, tenantId, { orgDone: true });
      void reload();
    } finally {
      setBusy(false);
    }
  }

  async function inviteManager() {
    if (!userId || mode.kind !== 'first-run') return;
    setBusy(true);
    setNotice(null);
    try {
      const values = await inviteForm.validateFields();
      const roleKey = values.roleKey;
      let role: string | { presetId: string } = 'Manager';
      if (roleKey.startsWith('preset:')) {
        role = { presetId: roleKey.slice('preset:'.length) };
      } else if (roleKey.startsWith('role:')) {
        role = roleKey.slice('role:'.length);
      }
      const res = await portalMutate(bffInvites(tenantId), {
        email: values.email.trim(),
        role,
        idempotencyKey: crypto.randomUUID(),
      });
      if (res.networkError || res.timedOut || res.status >= 500) {
        setNotice(t('onboarding.firstRun.inviteUnknown'));
        return;
      }
      if (res.status === 403 && apiErrorCode(res.json) === 'TENANT_PENDING') {
        setNotice(t('onboarding.pending.mutationBlocked'));
        void reload();
        return;
      }
      if (res.status !== 200 && res.status !== 201) {
        setNotice(
          t('ops.export.apiRejected', {
            code: apiErrorCode(res.json) ?? res.status,
            message: apiErrorMessage(res.json, t('onboarding.firstRun.inviteFailed')),
          }),
        );
        return;
      }
      patchOnboardingProgress(userId, tenantId, { inviteDone: true });
      inviteForm.resetFields(['email']);
      void reload();
    } finally {
      setBusy(false);
    }
  }

  function skipInvite() {
    if (!userId) return;
    patchOnboardingProgress(userId, tenantId, { inviteDone: true });
    void reload();
  }

  function completeFirstRun() {
    if (!userId) return;
    patchOnboardingProgress(userId, tenantId, { completed: true });
    router.push(`/t/${tenantId}`);
  }

  if (mode.kind === 'loading' || mode.kind === 'done') {
    return <SurfaceState kind="loading" />;
  }
  if (mode.kind === 'error') {
    return (
      <SurfaceState
        kind="error"
        description={mode.message}
        onRetry={() => void reload()}
      />
    );
  }
  if (mode.kind === 'denied') {
    return (
      <SurfaceState
        kind="permission-denied"
        description={
          mode.reason === 'attendee'
            ? t('shell.auth.attendeeDeniedBody')
            : t('onboarding.denied')
        }
        onRetry={() => {
          window.location.href = '/onboarding';
        }}
      />
    );
  }

  if (mode.kind === 'pending') {
    return (
      <Card style={{ maxWidth: 640, margin: '48px auto' }}>
        <SurfaceState
          kind="pending-activation"
          title={t('onboarding.pending.title')}
          description={t('onboarding.pending.body', {
            name: mode.tenant.name,
            slug: mode.tenant.slug,
          })}
          emptyAction={
            <Space>
              <Button onClick={() => void reload()}>
                {t('onboarding.pending.refresh')}
              </Button>
              <Link href="/account/security">
                <Button type="default">{t('home.h_cb3p8s')}</Button>
              </Link>
            </Space>
          }
        />
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
          message={t('onboarding.pending.noAdmin')}
        />
      </Card>
    );
  }

  // first-run
  const { tenant, progress, events } = mode;
  const hasEvent = events.length > 0;
  const current = firstRunCurrentStep({ progress, hasEvent });
  const firstEvent = events[0];

  return (
    <Card style={{ maxWidth: 720, margin: '32px auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            {t('onboarding.firstRun.title')}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t('onboarding.firstRun.lead', { name: tenant.name })}
          </Typography.Paragraph>
        </div>

        <Steps
          current={current}
          items={[
            { title: t('onboarding.firstRun.stepOrg') },
            { title: t('onboarding.firstRun.stepTeam') },
            { title: t('onboarding.firstRun.stepEvent') },
            { title: t('onboarding.firstRun.stepReady') },
          ]}
        />

        {notice ? (
          <Alert type="error" showIcon message={notice} role="alert" />
        ) : null}

        {current === 0 ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text>{t('onboarding.firstRun.orgHint')}</Typography.Text>
            <Form form={orgForm} layout="vertical" disabled={busy}>
              <Form.Item
                name="displayName"
                label={t('onboarding.firstRun.displayName')}
                rules={[{ required: true }]}
              >
                <Input maxLength={200} />
              </Form.Item>
              <Form.Item
                name="primaryColor"
                label={t('onboarding.firstRun.primaryColor')}
                rules={[{ required: true }]}
              >
                <Input placeholder={DEFAULT_TENANT_PRIMARY_COLOR} />
              </Form.Item>
              <Button type="primary" loading={busy} onClick={() => void saveOrg()}>
                {t('onboarding.firstRun.saveOrg')}
              </Button>
            </Form>
          </Space>
        ) : null}

        {current === 1 ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text>{t('onboarding.firstRun.teamHint')}</Typography.Text>
            <Form
              form={inviteForm}
              layout="vertical"
              disabled={busy}
              initialValues={{ roleKey: 'role:Manager' }}
            >
              <Form.Item
                name="email"
                label={t('onboarding.firstRun.managerEmail')}
                rules={[
                  {
                    required: true,
                    type: 'email',
                    message: t('members.h_1rjw0n9'),
                  },
                ]}
              >
                <Input placeholder="manager@example.com" />
              </Form.Item>
              <Form.Item
                name="roleKey"
                label={t('onboarding.firstRun.rolePreset')}
                rules={[{ required: true }]}
              >
                <Select options={roleOptions} />
              </Form.Item>
              <Space>
                <Button
                  type="primary"
                  loading={busy}
                  onClick={() => void inviteManager()}
                >
                  {t('onboarding.firstRun.inviteSubmit')}
                </Button>
                <Button onClick={skipInvite}>
                  {t('onboarding.firstRun.inviteSkip')}
                </Button>
              </Space>
            </Form>
          </Space>
        ) : null}

        {current === 2 ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text>{t('onboarding.firstRun.eventHint')}</Typography.Text>
            <Link href={`/t/${tenantId}/events/new`}>
              <Button type="primary">{t('onboarding.firstRun.createEvent')}</Button>
            </Link>
            <Button onClick={() => void reload()}>
              {t('onboarding.firstRun.refreshEvents')}
            </Button>
          </Space>
        ) : null}

        {current === 3 ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Result
              status="success"
              title={t('onboarding.firstRun.readyTitle')}
              subTitle={t('onboarding.firstRun.readyBody')}
            />
            <Alert
              type="info"
              showIcon
              message={t('readiness.summary.allReady')}
            />
            {firstEvent ? (
              <Link href={`/t/${tenantId}/e/${firstEvent.eventId}/setup`}>
                <Button>{t('onboarding.firstRun.openSetup')}</Button>
              </Link>
            ) : null}
            <Button type="primary" onClick={completeFirstRun}>
              {t('onboarding.firstRun.enterPortal')}
            </Button>
          </Space>
        ) : null}
      </Space>
    </Card>
  );
}
