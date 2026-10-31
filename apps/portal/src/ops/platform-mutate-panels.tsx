'use client';

import type { PlatformTenantDetail, TenantLimitsDto } from '@ticket/contracts';
import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Typography,
} from 'antd';
import { useCallback, useEffect } from 'react';
import { useActorState as useState } from '../client/use-actor-state';
import { portalGet, portalMutate } from '../client/portal-fetch';
import { useMutationIntent } from '../client/use-mutation-intent';
import { MutationIntentAlert } from '../client/mutation-intent-alert';
import { usePortalLocale } from '../i18n';
import {
  bffPlatformSupportGrants,
  bffPlatformTenant,
  bffPlatformTenantLimits,
  bffPlatformTenantStatus,
  bffPlatformTenants,
} from '../prep/bff-urls';
import {
  interpretPlatformCreateTenant,
  interpretPlatformMutationOk,
  interpretPlatformSupportGrantCreate,
  interpretPlatformTenantDetail,
  type PlatformCreateTenantView,
  type PlatformMutationOkView,
  type PlatformSupportGrantCreateView,
  type PlatformTenantDetailView,
} from './platform-zone';

type Props = {
  onTenantCreated?: (tenantId: string) => void;
  initialManageTenantId?: string;
};

const DEFAULT_LIMITS: TenantLimitsDto = {
  maxEvents: null,
  maxStaff: null,
  emailPerDay: null,
  importRowsPerJob: null,
};

export function PlatformProvisionPanel({ onTenantCreated }: Props) {
  const { t, locale } = usePortalLocale();
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<PlatformCreateTenantView | null>(null);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const provisionIntent = useMutationIntent('platform', undefined, 'platform-provision');

  const submit = useCallback(async () => {
    setBusy(true);
    setView(null);
    const outcome = await provisionIntent.run(
      {
        slug: slug.trim(),
        name: name.trim(),
        defaultTimezone: timezone.trim(),
        ownerEmail: ownerEmail.trim(),
        limits: DEFAULT_LIMITS,
        flags: { importsEnabled: true, exportsEnabled: true },
      },
      (body) => portalMutate(bffPlatformTenants(), body),
      (res) => interpretPlatformCreateTenant(
        res.status,
        res.json,
        res.networkError || res.timedOut,
        locale,
      ).kind === 'ok',
    );
    if (outcome.kind === 'blocked') {
      setView({ kind: 'unknown', message: t('intent.blocked') });
      setBusy(false);
      return;
    }
    const res = outcome.response;
    const next = interpretPlatformCreateTenant(
      res.status,
      res.json,
      res.networkError || res.timedOut,
      locale,
    );
    setView(next);
    if (next.kind === 'ok') {
      provisionIntent.release();
      onTenantCreated?.(next.result.tenantId);
    }
    setBusy(false);
  }, [slug, name, ownerEmail, timezone, locale, onTenantCreated, provisionIntent, t]);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Typography.Text>{t('platform.mutate.provisionTitle')}</Typography.Text>
      <Input
        placeholder={t('platform.mutate.phSlug')}
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        spellCheck={false}
        data-testid="platform-provision-slug"
      />
      <Input
        placeholder={t('platform.mutate.phName')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        data-testid="platform-provision-name"
      />
      <Input
        placeholder={t('platform.mutate.phOwnerEmail')}
        value={ownerEmail}
        onChange={(e) => setOwnerEmail(e.target.value)}
        autoComplete="off"
        data-testid="platform-provision-owner-email"
      />
      <Input
        placeholder={t('platform.mutate.phTimezone')}
        value={timezone}
        onChange={(e) => setTimezone(e.target.value)}
        spellCheck={false}
        data-testid="platform-provision-timezone"
      />
      <Button
        type="primary"
        loading={busy}
        onClick={() => void submit()}
        data-testid="platform-provision-submit"
      >
        {t('platform.mutate.createTenant')}
      </Button>
      <MutationIntentAlert
        pending={provisionIntent.pending}
        needsReconciliation={provisionIntent.needsReconciliation}
        onCheck={() => undefined}
        onStartNew={provisionIntent.release}
      />
      {view?.kind === 'ok' ? (
        <Alert
          type="success"
          showIcon
          message={`tenantId=${view.result.tenantId} · invite=${view.result.ownerInviteId}`}
          data-testid="platform-provision-status"
        />
      ) : null}
      {view?.kind === 'rejected' || view?.kind === 'unknown' ? (
        <Alert
          type="error"
          showIcon
          message={view.message}
          data-testid="platform-provision-status"
        />
      ) : null}
    </Space>
  );
}

export function PlatformManagePanel({ initialManageTenantId = '' }: Props) {
  const { t, locale } = usePortalLocale();
  const [tenantId, setTenantId] = useState(() => initialManageTenantId);
  const [reason, setReason] = useState('ops');
  const [detailBusy, setDetailBusy] = useState(false);
  const [mutateBusy, setMutateBusy] = useState(false);
  const [detailView, setDetailView] = useState<PlatformTenantDetailView | null>(
    null,
  );
  const [detail, setDetail] = useState<PlatformTenantDetail | null>(null);
  const [limitsDraft, setLimitsDraft] = useState<TenantLimitsDto>(DEFAULT_LIMITS);
  const [importsEnabled, setImportsEnabled] = useState(true);
  const [exportsEnabled, setExportsEnabled] = useState(true);
  const [mutateView, setMutateView] = useState<PlatformMutationOkView | null>(
    null,
  );
  const statusIntent = useMutationIntent(tenantId.trim() || 'platform', undefined, 'platform-status');
  const limitsIntent = useMutationIntent(tenantId.trim() || 'platform', undefined, 'platform-limits');

  const loadDetail = useCallback(async () => {
    const id = tenantId.trim();
    setDetailBusy(true);
    setDetailView(null);
    setDetail(null);
    setMutateView(null);
    if (!id) {
      setDetailView({
        kind: 'rejected',
        code: 'INVALID_INPUT',
        message: t('platform.pickTenant'),
      });
      setDetailBusy(false);
      return;
    }
    const res = await portalGet(bffPlatformTenant(id));
    const next = interpretPlatformTenantDetail(
      res.status,
      res.json,
      res.networkError || res.timedOut,
      locale,
    );
    setDetailView(next);
    if (next.kind === 'ok') {
      setDetail(next.detail);
      setLimitsDraft(next.detail.limits);
      setImportsEnabled(next.detail.flags.importsEnabled);
      setExportsEnabled(next.detail.flags.exportsEnabled);
    }
    setDetailBusy(false);
  }, [tenantId, locale, t]);

  useEffect(() => {
    const id = initialManageTenantId.trim();
    if (!id) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void (async () => {
        setDetailBusy(true);
        setDetailView(null);
        setDetail(null);
        setMutateView(null);
        const res = await portalGet(bffPlatformTenant(id));
        if (cancelled) return;
        const next = interpretPlatformTenantDetail(
          res.status,
          res.json,
          res.networkError || res.timedOut,
          locale,
        );
        setDetailView(next);
        if (next.kind === 'ok') {
          setDetail(next.detail);
          setLimitsDraft(next.detail.limits);
          setImportsEnabled(next.detail.flags.importsEnabled);
          setExportsEnabled(next.detail.flags.exportsEnabled);
        }
        setDetailBusy(false);
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [initialManageTenantId, locale]);

  const postStatus = useCallback(
    async (status: 'ACTIVE' | 'SUSPENDED') => {
      if (!detail) return;
      setMutateBusy(true);
      setMutateView(null);
      const outcome = await statusIntent.run(
        {
          status,
          reason: reason.trim() || 'ops',
          expectedVersion: detail.version,
        },
        (body) => portalMutate(bffPlatformTenantStatus(detail.tenantId), body),
        (res) => interpretPlatformMutationOk(
          res.status,
          res.json,
          res.networkError || res.timedOut,
          locale,
        ).kind === 'ok',
      );
      if (outcome.kind === 'blocked') {
        setMutateView({ kind: 'unknown', message: t('intent.blocked') });
        setMutateBusy(false);
        return;
      }
      const res = outcome.response;
      const next = interpretPlatformMutationOk(
        res.status,
        res.json,
        res.networkError || res.timedOut,
        locale,
      );
      setMutateView(next);
      if (next.kind === 'ok') {
        statusIntent.release();
        void loadDetail();
      }
      setMutateBusy(false);
    },
    [detail, reason, locale, loadDetail, statusIntent, t],
  );

  const saveLimits = useCallback(async () => {
    if (!detail) return;
    setMutateBusy(true);
    setMutateView(null);
    const outcome = await limitsIntent.run(
      {
        limits: limitsDraft,
        flags: { importsEnabled, exportsEnabled },
        reason: reason.trim() || 'ops',
        expectedVersion: detail.version,
      },
      (body) => portalMutate(bffPlatformTenantLimits(detail.tenantId), body, 'PUT'),
      (res) => interpretPlatformMutationOk(
        res.status,
        res.json,
        res.networkError || res.timedOut,
        locale,
      ).kind === 'ok',
    );
    if (outcome.kind === 'blocked') {
      setMutateView({ kind: 'unknown', message: t('intent.blocked') });
      setMutateBusy(false);
      return;
    }
    const res = outcome.response;
    const next = interpretPlatformMutationOk(
      res.status,
      res.json,
      res.networkError || res.timedOut,
      locale,
    );
    setMutateView(next);
    if (next.kind === 'ok') {
      limitsIntent.release();
      void loadDetail();
    }
    setMutateBusy(false);
  }, [
    detail,
    limitsDraft,
    importsEnabled,
    exportsEnabled,
    reason,
    locale,
    loadDetail,
    limitsIntent,
    t,
  ]);

  const confirmStatus = (status: 'ACTIVE' | 'SUSPENDED') => {
    Modal.confirm({
      title:
        status === 'SUSPENDED'
          ? t('platform.mutate.confirmSuspend')
          : t('platform.mutate.confirmActivate'),
      onOk: () => postStatus(status),
    });
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Typography.Text>{t('platform.mutate.manageTitle')}</Typography.Text>
      <Space wrap>
        <Input
          placeholder={t('platform.h_ggf21i')}
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          style={{ minWidth: 320 }}
          spellCheck={false}
          data-testid="platform-manage-tenant-input"
        />
        <Button
          type="primary"
          loading={detailBusy}
          onClick={() => void loadDetail()}
          data-testid="platform-manage-load"
        >
          {t('platform.mutate.loadDetail')}
        </Button>
      </Space>
      <Input
        placeholder={t('platform.mutate.phReasonStatusLimits')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        data-testid="platform-manage-reason"
      />
      {detailView?.kind === 'rejected' || detailView?.kind === 'unknown' ? (
        <Alert
          type="warning"
          showIcon
          message={detailView.message}
          data-testid="platform-manage-detail-status"
        />
      ) : null}
      {detail ? (
        <>
          <Descriptions
            size="small"
            column={1}
            bordered
            data-testid="platform-tenant-detail"
            items={[
              { key: 'slug', label: 'Slug', children: detail.slug },
              { key: 'status', label: 'Status', children: detail.status },
              { key: 'version', label: 'Version', children: detail.version },
              {
                key: 'usage',
                label: 'Usage',
                children: `events=${detail.usage.events} staff=${detail.usage.staffActive}`,
              },
            ]}
          />
          <Form layout="vertical" size="small">
            {(
              [
                ['maxEvents', 'maxEvents'],
                ['maxStaff', 'maxStaff'],
                ['emailPerDay', 'emailPerDay'],
                ['importRowsPerJob', 'importRowsPerJob'],
              ] as const
            ).map(([key, label]) => (
              <Form.Item key={key} label={`${label} (null=unlimited)`}>
                <InputNumber
                  style={{ width: '100%' }}
                  value={limitsDraft[key]}
                  onChange={(v) =>
                    setLimitsDraft((prev) => ({
                      ...prev,
                      [key]: typeof v === 'number' ? v : null,
                    }))
                  }
                />
              </Form.Item>
            ))}
            <Checkbox
              checked={importsEnabled}
              onChange={(e) => setImportsEnabled(e.target.checked)}
            >
              {t('platform.mutate.importsEnabled')}
            </Checkbox>
            <Checkbox
              checked={exportsEnabled}
              onChange={(e) => setExportsEnabled(e.target.checked)}
            >
              {t('platform.mutate.exportsEnabled')}
            </Checkbox>
          </Form>
          <Space wrap>
            <Button
              danger
              loading={mutateBusy}
              disabled={detail.status === 'SUSPENDED'}
              onClick={() => confirmStatus('SUSPENDED')}
              data-testid="platform-manage-suspend"
            >
              {t('platform.mutate.suspend')}
            </Button>
            <Button
              loading={mutateBusy}
              disabled={detail.status === 'ACTIVE'}
              onClick={() => confirmStatus('ACTIVE')}
              data-testid="platform-manage-activate"
            >
              {t('platform.mutate.activate')}
            </Button>
            <Button
              type="primary"
              loading={mutateBusy}
              onClick={() => void saveLimits()}
              data-testid="platform-manage-save-limits"
            >
              {t('platform.mutate.saveLimits')}
            </Button>
          </Space>
        </>
      ) : null}
      <MutationIntentAlert
        pending={statusIntent.pending}
        needsReconciliation={statusIntent.needsReconciliation}
        onCheck={() => void loadDetail()}
        onStartNew={statusIntent.release}
      />
      <MutationIntentAlert
        pending={limitsIntent.pending}
        needsReconciliation={limitsIntent.needsReconciliation}
        onCheck={() => void loadDetail()}
        onStartNew={limitsIntent.release}
      />
      {mutateView?.kind === 'ok' ? (
        <Alert type="success" showIcon message="OK" data-testid="platform-manage-mutate-status" />
      ) : null}
      {mutateView?.kind === 'rejected' || mutateView?.kind === 'unknown' ? (
        <Alert
          type="error"
          showIcon
          message={mutateView.message}
          data-testid="platform-manage-mutate-status"
        />
      ) : null}
    </Space>
  );
}

export function PlatformGrantCreatePanel() {
  const { t, locale } = usePortalLocale();
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<PlatformSupportGrantCreateView | null>(null);
  const [tenantId, setTenantId] = useState('');
  const [eventId, setEventId] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const grantIntent = useMutationIntent('platform', undefined, 'platform-grant');

  const submit = useCallback(async () => {
    setBusy(true);
    setView(null);
    const expires =
      expiresAt.trim() ||
      new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const outcome = await grantIntent.run(
      {
        tenantId: tenantId.trim(),
        eventId: eventId.trim(),
        scopes: ['cs.read'],
        reason: grantReason.trim(),
        expiresAt: expires,
      },
      (body) => portalMutate(bffPlatformSupportGrants(), body),
      (res) => interpretPlatformSupportGrantCreate(
        res.status,
        res.json,
        res.networkError || res.timedOut,
        locale,
      ).kind === 'ok',
    );
    if (outcome.kind === 'blocked') {
      setView({ kind: 'unknown', message: t('intent.blocked') });
      setBusy(false);
      return;
    }
    const res = outcome.response;
    const next = interpretPlatformSupportGrantCreate(
      res.status,
      res.json,
      res.networkError || res.timedOut,
      locale,
    );
    setView(next);
    if (next.kind === 'ok') grantIntent.release();
    setBusy(false);
  }, [tenantId, eventId, grantReason, expiresAt, locale, grantIntent, t]);

  const confirmGrant = () => {
    Modal.confirm({
      title: t('platform.mutate.confirmGrant'),
      onOk: () => submit(),
    });
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Typography.Text>{t('platform.mutate.grantCreateTitle')}</Typography.Text>
      <Input
        placeholder={t('platform.mutate.phTenantId')}
        value={tenantId}
        onChange={(e) => setTenantId(e.target.value)}
        spellCheck={false}
        data-testid="platform-grant-create-tenant"
      />
      <Input
        placeholder={t('platform.mutate.phEventId')}
        value={eventId}
        onChange={(e) => setEventId(e.target.value)}
        spellCheck={false}
        data-testid="platform-grant-create-event"
      />
      <Input.TextArea
        placeholder={t('platform.mutate.phReason')}
        value={grantReason}
        onChange={(e) => setGrantReason(e.target.value)}
        maxLength={500}
        rows={3}
        data-testid="platform-grant-create-reason"
      />
      <Input
        placeholder={t('platform.mutate.phExpiresAt')}
        value={expiresAt}
        onChange={(e) => setExpiresAt(e.target.value)}
        spellCheck={false}
        data-testid="platform-grant-create-expires"
      />
      <Button
        type="primary"
        loading={busy}
        onClick={() => confirmGrant()}
        data-testid="platform-grant-create-submit"
      >
        {t('platform.mutate.createGrant')}
      </Button>
      <MutationIntentAlert
        pending={grantIntent.pending}
        needsReconciliation={grantIntent.needsReconciliation}
        onCheck={() => undefined}
        onStartNew={grantIntent.release}
      />
      {view?.kind === 'ok' ? (
        <Alert
          type="success"
          showIcon
          message={`grantId=${view.grant.grantId} · expires=${view.grant.expiresAt}`}
          data-testid="platform-grant-create-status"
        />
      ) : null}
      {view?.kind === 'rejected' || view?.kind === 'unknown' ? (
        <Alert
          type="error"
          showIcon
          message={view.message}
          data-testid="platform-grant-create-status"
        />
      ) : null}
    </Space>
  );
}
