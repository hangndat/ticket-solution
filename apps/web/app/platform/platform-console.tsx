'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  interpretCreateTenant,
  interpretPlatformMe,
  interpretSupportGrant,
  interpretTenantDetail,
  viewLabel,
  type ViewResult,
} from '../../src/platform/shape';
import type {
  PlatformCreateTenantResponse,
  PlatformMeResponse,
  PlatformTenantDetail,
  SupportGrantResponse,
} from '../../src/platform/contracts';
import {
  platformGet,
  platformMutate,
} from '../../src/platform/client-fetch';
import { REQUEST_TIMEOUT_MS } from '../../src/redeem/poll-operation';

type Props = { misconfigured: boolean; initialError?: string };

export function PlatformConsole({ misconfigured, initialError }: Props) {
  const router = useRouter();
  const [me, setMe] = useState<ViewResult<PlatformMeResponse> | null>(null);
  const [createView, setCreateView] =
    useState<ViewResult<PlatformCreateTenantResponse> | null>(null);
  const [grantView, setGrantView] =
    useState<ViewResult<SupportGrantResponse> | null>(null);
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [grantTenantId, setGrantTenantId] = useState('');
  const [grantEventId, setGrantEventId] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [grantExpiresAt, setGrantExpiresAt] = useState('');
  const [manageTenantId, setManageTenantId] = useState('');
  const [detail, setDetail] = useState<ViewResult<PlatformTenantDetail> | null>(
    null,
  );
  const [healthJson, setHealthJson] = useState<string | null>(null);
  const [statusReason, setStatusReason] = useState('ops');
  const [manageNotice, setManageNotice] = useState<string | null>(null);

  useEffect(() => {
    if (misconfigured) return;
    void (async () => {
      const result = await platformGet(
        '/api/bff/platform/me',
        REQUEST_TIMEOUT_MS,
      );
      setMe(
        interpretPlatformMe(
          result.status,
          result.json,
          result.networkError || result.timedOut,
        ),
      );
    })();
  }, [misconfigured]);

  async function createTenant() {
    setBusy(true);
    setCreateView(null);
    const result = await platformMutate(
      '/api/bff/platform/tenants',
      {
        slug: slug.trim(),
        name: name.trim(),
        defaultTimezone: timezone.trim(),
        ownerEmail: ownerEmail.trim(),
        limits: {
          maxEvents: null,
          maxStaff: null,
          emailPerDay: null,
          importRowsPerJob: null,
        },
        flags: { importsEnabled: true, exportsEnabled: true },
        idempotencyKey: crypto.randomUUID(),
      },
      REQUEST_TIMEOUT_MS,
    );
    setCreateView(
      interpretCreateTenant(
        result.status,
        result.json,
        result.networkError || result.timedOut,
      ),
    );
    setBusy(false);
  }

  async function createSupportGrant() {
    setBusy(true);
    setGrantView(null);
    // Default expiry hint: max 1h from now (security config); backend enforces.
    const expires =
      grantExpiresAt.trim() ||
      new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const result = await platformMutate(
      '/api/bff/platform/support-grants',
      {
        tenantId: grantTenantId.trim(),
        eventId: grantEventId.trim(),
        scopes: ['cs.read'],
        reason: grantReason.trim(),
        expiresAt: expires,
        idempotencyKey: crypto.randomUUID(),
      },
      REQUEST_TIMEOUT_MS,
    );
    setGrantView(
      interpretSupportGrant(
        result.status,
        result.json,
        result.networkError || result.timedOut,
      ),
    );
    setBusy(false);
  }

  if (misconfigured) {
    return (
      <aside className="notice auth-unconfigured" role="status">
        <h2>Platform OIDC chưa cấu hình</h2>
        <p>
          Fail closed — thiếu PLATFORM_OIDC_CLIENT_ID / SECRET / REDIRECT_URI /
          AUDIENCE / REQUIRED_ACR. Không mock MFA hay operator claim.
        </p>
      </aside>
    );
  }

  const notice =
    createView ??
    grantView ??
    (me && me.kind !== 'ok' ? me : null);

  return (
    <div className="redeem-form">
      {initialError ? (
        <p className="redeem-status redeem-status--error" role="alert">
          Đăng nhập platform lỗi: {initialError}
        </p>
      ) : null}
      <div className="auth-buttons">
        <a className="button-link" href="/api/auth/platform/login">
          Đăng nhập platform (MFA)
        </a>
        <button
          type="button"
          onClick={() => {
            void fetch('/api/auth/platform/logout', { method: 'POST' }).then(
              () => {
                setMe(null);
                router.push('/platform');
                router.refresh();
              },
            );
          }}
        >
          Đăng xuất platform
        </button>
      </div>
      {me?.kind === 'ok' ? (
        <dl data-testid="platform-me">
          <div>
            <dt>Operator</dt>
            <dd>{String(me.value.operator)}</dd>
          </div>
          <div>
            <dt>Assurance</dt>
            <dd>{me.value.assurance}</dd>
          </div>
          <div>
            <dt>Commands</dt>
            <dd>{me.value.permittedCommands.join(', ') || '(none)'}</dd>
          </div>
        </dl>
      ) : null}
      {me?.kind === 'ok' && me.value.assurance === 'missing' ? (
        <p className="redeem-status redeem-status--error" role="status">
          MFA_REQUIRED — phiên thiếu assurance. Backend sẽ từ chối lệnh operator.
        </p>
      ) : null}

      <section className="admin-section" aria-labelledby="provision-heading">
        <h2 id="provision-heading">Tạo tenant (Operator)</h2>
        <p>
          Status PENDING + owner invite. Limits null = unlimited. Không seed
          membership SQL.
        </p>
        <label>
          Slug
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Owner email
          <input
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label>
          Timezone
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void createTenant()}
        >
          Tạo tenant
        </button>
      </section>

      <section className="admin-section" aria-labelledby="manage-heading">
        <h2 id="manage-heading">Status / limits / health</h2>
        <p>
          Limits null = unlimited. SUSPENDED chặn issue/admin nhưng giữ vé/Gate/
          recovery. Health chỉ count/error code sanitize.
        </p>
        <label>
          Tenant ID
          <input
            value={manageTenantId}
            onChange={(e) => setManageTenantId(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Reason (status/limits)
          <input
            value={statusReason}
            onChange={(e) => setStatusReason(e.target.value)}
          />
        </label>
        <div className="auth-buttons">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                const result = await platformGet(
                  `/api/bff/platform/tenants/${encodeURIComponent(manageTenantId.trim())}`,
                  REQUEST_TIMEOUT_MS,
                );
                setDetail(
                  interpretTenantDetail(
                    result.status,
                    result.json,
                    result.networkError || result.timedOut,
                  ),
                );
                setBusy(false);
              })();
            }}
          >
            Tải detail
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                const result = await platformGet(
                  `/api/bff/platform/tenants/${encodeURIComponent(manageTenantId.trim())}/health`,
                  REQUEST_TIMEOUT_MS,
                );
                setHealthJson(
                  JSON.stringify(
                    { status: result.status, body: result.json },
                    null,
                    2,
                  ),
                );
                setBusy(false);
              })();
            }}
          >
            Health
          </button>
          <button
            type="button"
            disabled={busy || detail?.kind !== 'ok'}
            onClick={() => {
              void (async () => {
                if (detail?.kind !== 'ok') return;
                setBusy(true);
                setManageNotice(null);
                const result = await platformMutate(
                  `/api/bff/platform/tenants/${encodeURIComponent(manageTenantId.trim())}/status`,
                  {
                    status: 'SUSPENDED',
                    reason: statusReason.trim() || 'ops',
                    expectedVersion: detail.value.version,
                    idempotencyKey: crypto.randomUUID(),
                  },
                  REQUEST_TIMEOUT_MS,
                );
                setManageNotice(
                  result.status >= 200 && result.status < 300
                    ? 'Đã SUSPENDED (vé/Gate/recovery vẫn dùng).'
                    : `status HTTP ${result.status}`,
                );
                setBusy(false);
              })();
            }}
          >
            Suspend
          </button>
          <button
            type="button"
            disabled={busy || detail?.kind !== 'ok'}
            onClick={() => {
              void (async () => {
                if (detail?.kind !== 'ok') return;
                setBusy(true);
                setManageNotice(null);
                const result = await platformMutate(
                  `/api/bff/platform/tenants/${encodeURIComponent(manageTenantId.trim())}/status`,
                  {
                    status: 'ACTIVE',
                    reason: statusReason.trim() || 'ops',
                    expectedVersion: detail.value.version,
                    idempotencyKey: crypto.randomUUID(),
                  },
                  REQUEST_TIMEOUT_MS,
                );
                setManageNotice(
                  result.status >= 200 && result.status < 300
                    ? 'Đã ACTIVE.'
                    : `status HTTP ${result.status}`,
                );
                setBusy(false);
              })();
            }}
          >
            Activate
          </button>
          <button
            type="button"
            disabled={busy || detail?.kind !== 'ok'}
            onClick={() => {
              void (async () => {
                if (detail?.kind !== 'ok') return;
                setBusy(true);
                setManageNotice(null);
                const result = await platformMutate(
                  `/api/bff/platform/tenants/${encodeURIComponent(manageTenantId.trim())}/limits`,
                  {
                    limits: detail.value.limits,
                    flags: detail.value.flags,
                    reason: statusReason.trim() || 'ops',
                    expectedVersion: detail.value.version,
                    idempotencyKey: crypto.randomUUID(),
                  },
                  REQUEST_TIMEOUT_MS,
                  'PUT',
                );
                setManageNotice(
                  result.status >= 200 && result.status < 300
                    ? 'Limits/flags đã cập nhật (null = unlimited).'
                    : `limits HTTP ${result.status}`,
                );
                setBusy(false);
              })();
            }}
          >
            Refresh limits (same values)
          </button>
        </div>
        {detail?.kind === 'ok' ? (
          <dl data-testid="platform-tenant-detail">
            <div>
              <dt>Status</dt>
              <dd>{detail.value.status}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{detail.value.version}</dd>
            </div>
            <div>
              <dt>Limits</dt>
              <dd>
                events={String(detail.value.limits.maxEvents)} staff=
                {String(detail.value.limits.maxStaff)} email/day=
                {String(detail.value.limits.emailPerDay)} import=
                {String(detail.value.limits.importRowsPerJob)} (null=unlimited)
              </dd>
            </div>
            <div>
              <dt>Usage</dt>
              <dd>
                events={detail.value.usage.events} staff=
                {detail.value.usage.staffActive} invites=
                {detail.value.usage.staffPendingInvites} emailToday=
                {detail.value.usage.emailToday}
              </dd>
            </div>
          </dl>
        ) : detail ? (
          <p>{viewLabel(detail)}</p>
        ) : null}
        {healthJson ? (
          <pre className="me-result" data-testid="platform-health">
            {healthJson}
          </pre>
        ) : null}
        {manageNotice ? <p role="status">{manageNotice}</p> : null}
      </section>

      <section className="admin-section" aria-labelledby="support-heading">
        <h2 id="support-heading">Support grant (cs.read)</h2>
        <p>
          Banner read-only: lý do + hết hạn (tối đa 1h theo cấu hình security).
          Không impersonate / resend / export.
        </p>
        <label>
          Tenant ID
          <input
            value={grantTenantId}
            onChange={(e) => setGrantTenantId(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Event ID
          <input
            value={grantEventId}
            onChange={(e) => setGrantEventId(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Reason
          <textarea
            value={grantReason}
            onChange={(e) => setGrantReason(e.target.value)}
            maxLength={500}
            rows={3}
          />
        </label>
        <label>
          Expires at (ISO, trống = +1h)
          <input
            value={grantExpiresAt}
            onChange={(e) => setGrantExpiresAt(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void createSupportGrant()}
        >
          Cấp support grant
        </button>
        {grantView?.kind === 'ok' ? (
          <aside
            className="notice"
            role="status"
            data-testid="support-grant-banner"
          >
            <strong>Support read-only</strong>
            <p>
              Grant {grantView.value.grantId} · event {grantView.value.eventId}{' '}
              · hết hạn {grantView.value.expiresAt} · scope cs.read
            </p>
          </aside>
        ) : null}
      </section>

      {notice ? (
        <section
          className={
            notice.kind === 'rejected'
              ? 'redeem-status redeem-status--error'
              : 'notice'
          }
          role="alert"
          data-testid="platform-notice"
        >
          <p>
            {notice.kind === 'ok'
              ? JSON.stringify(notice.value)
              : viewLabel(notice)}
          </p>
        </section>
      ) : null}
    </div>
  );
}
