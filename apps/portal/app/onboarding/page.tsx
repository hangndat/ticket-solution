'use client';

import { Alert, Button, Card, Flex, Form, Input, Result, Select, Space, Spin, Typography } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  apiErrorCode,
  apiErrorMessage,
  portalMutate,
} from '../../src/client/portal-fetch';
import { usePortalLocale } from '../../src/i18n';
import { SURFACE_MESSAGE_KEYS } from '../../src/prep/surface-copy';
import { loadShellContext } from '../../src/nav/load-shell-context';
import {
  normalizeRegistrationBody,
  parseRegistrationResponse,
  resolveOnboardingSurface,
} from '../../src/onboarding';
import { bffTenantRegistrations } from '../../src/prep/bff-urls';
import { usePortalUserId } from '../../src/views/use-portal-user-id';
import { useMutationIntent } from '../../src/client/use-mutation-intent';
import { MutationIntentAlert } from '../../src/client/mutation-intent-alert';

const TIMEZONES = [
  'Asia/Ho_Chi_Minh',
  'Asia/Bangkok',
  'Asia/Singapore',
  'UTC',
];

/**
 * /onboarding — self-serve signup OR redirect to PENDING wait / first-run.
 * Never fakes ACTIVE (P2-ONBOARD-PENDING / AC-PS5).
 */
export default function OnboardingEntryPage() {
  const { t } = usePortalLocale();
  const router = useRouter();
  const identity = usePortalUserId();
  const [phase, setPhase] = useState<
    'loading' | 'signup' | 'redirecting' | 'customer'
  >('loading');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const signupIntent = useMutationIntent('new-tenant', undefined, 'register-tenant');
  const [form] = Form.useForm<{
    slug: string;
    name: string;
    defaultTimezone: string;
    contact?: string;
  }>();

  const identityUserId =
    identity.status === 'ready' ? identity.userId : null;

  useEffect(() => {
    if (identity.status === 'loading') {
      return;
    }
    if (identity.status === 'unauthenticated') {
      window.location.replace('/api/auth/login?return=/onboarding');
      return;
    }

    let cancelled = false;
    void loadShellContext().then((shell) => {
      if (cancelled) return;
      if (shell.status === 'unauthenticated') {
        window.location.replace('/api/auth/login?return=/onboarding');
        return;
      }
      if (shell.status === 'error') {
        setPhase('signup');
        return;
      }
      if (shell.status !== 'ready') return;

      const surface = resolveOnboardingSurface({
        tenants: shell.meTenants?.items,
        userId: identityUserId,
        eventCountForTenant: (tenantId) =>
          shell.meEvents?.items.filter((e) => e.tenantId === tenantId).length ??
          0,
      });

      if (surface.kind === 'customer') {
        setPhase('customer');
        return;
      }
      if (surface.kind === 'signup') {
        setPhase('signup');
        return;
      }
      setPhase('redirecting');
      if (surface.kind === 'pending-activation' || surface.kind === 'first-run') {
        window.location.replace(`/onboarding/${surface.tenant.tenantId}`);
        return;
      }
      window.location.replace(`/t/${surface.tenant.tenantId}`);
    });
    return () => {
      cancelled = true;
    };
  }, [identity.status, identityUserId]);

  async function submit() {
    setBusy(true);
    setNotice(null);
    try {
      const values = await form.validateFields();
      const body = normalizeRegistrationBody(values);
      if (!body) {
        setNotice(t('onboarding.signup.invalid'));
        return;
      }
      const outcome = await signupIntent.run(body, (request) => portalMutate(bffTenantRegistrations(), request),
        (result) => parseRegistrationResponse(result.status, result.json) !== null);
      if (outcome.kind === 'blocked') {
        setNotice('Đăng ký trước chưa rõ kết quả. Kiểm tra danh sách tổ chức trước khi tiếp tục.');
        return;
      }
      const res = outcome.response;
      if (res.networkError || res.timedOut || res.status >= 500) {
        setNotice(t('onboarding.signup.unknown'));
        return;
      }
      const parsed = parseRegistrationResponse(res.status, res.json);
      if (parsed) {
        // Stay on PENDING wait — never route as ACTIVE.
        router.replace(`/onboarding/${parsed.tenantId}`);
        return;
      }
      if (res.status === 401) {
        window.location.href = '/api/auth/login?return=/onboarding';
        return;
      }
      setNotice(
        t('ops.export.apiRejected', {
          code: apiErrorCode(res.json) ?? res.status,
          message: apiErrorMessage(res.json, t('onboarding.signup.failed')),
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'loading' || phase === 'redirecting') {
    return (
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
  }

  if (phase === 'customer') {
    return (
      <Result status="403" title={t('shell.auth.attendeeDeniedTitle')} subTitle={t('shell.auth.attendeeDeniedBody')} />
    );
  }

  return (
    <Card
      style={{
        maxWidth: 560,
        margin: '48px auto',
        background:
          'linear-gradient(165deg, rgba(155,58,24,0.06) 0%, rgba(250,247,242,1) 42%, #fff 100%)',
      }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Typography.Title level={2} style={{ marginTop: 0, marginBottom: 8 }}>
            {t('onboarding.signup.title')}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t('onboarding.signup.lead')}
          </Typography.Paragraph>
        </div>

        {notice ? (
          <Alert type="error" showIcon message={notice} role="alert" />
        ) : null}
        <MutationIntentAlert pending={signupIntent.pending} needsReconciliation={signupIntent.needsReconciliation}
          onCheck={() => window.location.reload()} onStartNew={signupIntent.release} />

        <Form
          form={form}
          layout="vertical"
          initialValues={{ defaultTimezone: 'Asia/Ho_Chi_Minh' }}
          disabled={busy}
          onFinish={() => void submit()}
        >
          <Form.Item
            name="name"
            label={t('onboarding.signup.name')}
            rules={[{ required: true, message: t('onboarding.signup.nameRequired') }]}
          >
            <Input maxLength={200} autoComplete="organization" />
          </Form.Item>
          <Form.Item
            name="slug"
            label={t('onboarding.signup.slug')}
            rules={[
              { required: true, message: t('onboarding.signup.slugRequired') },
              {
                pattern: /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/,
                message: t('onboarding.signup.slugPattern'),
              },
            ]}
            extra={t('onboarding.signup.slugHint')}
          >
            <Input maxLength={64} placeholder="acme-events" />
          </Form.Item>
          <Form.Item
            name="defaultTimezone"
            label={t('onboarding.signup.timezone')}
            rules={[{ required: true }]}
          >
            <Select
              options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
            />
          </Form.Item>
          <Form.Item name="contact" label={t('onboarding.signup.contact')}>
            <Input maxLength={200} placeholder="ops@example.com" />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={t('onboarding.signup.pendingPolicy')}
          />
          <Space>
            <Button type="primary" htmlType="submit" loading={busy}>
              {t('onboarding.signup.submit')}
            </Button>
            <Link prefetch={false} href="/">
              <Button>{t('onboarding.backHome')}</Button>
            </Link>
          </Space>
        </Form>
      </Space>
    </Card>
  );
}
