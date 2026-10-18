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
import { SurfaceState } from '../../src/ui/surface-state';

type Props = { misconfigured: boolean; initialError?: string };

type HealthSummary = {
  ok: boolean;
  title: string;
  detail: string;
  rawJson: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function summarizeHealth(
  status: number,
  json: unknown,
  networkError: boolean,
  timedOut: boolean,
): HealthSummary {
  const rawJson =
    json === null || json === undefined
      ? null
      : (() => {
          try {
            return JSON.stringify(json, null, 2);
          } catch {
            return null;
          }
        })();
  if (networkError || timedOut || status === 0) {
    return {
      ok: false,
      title: 'Không đọc được sức khỏe tenant',
      detail: 'Mạng lỗi hoặc hết thời gian chờ — chưa khẳng định trạng thái.',
      rawJson,
    };
  }
  if (status < 200 || status >= 300) {
    const body = asRecord(json);
    const code = typeof body?.code === 'string' ? body.code : null;
    return {
      ok: false,
      title: 'Không đọc được sức khỏe tenant',
      detail: code
        ? `Máy chủ từ chối hoặc lỗi (${code}).`
        : 'Máy chủ không trả kết quả hợp lệ. Thử lại sau.',
      rawJson,
    };
  }
  const body = asRecord(json);
  const counts: string[] = [];
  if (body) {
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        counts.push(`${key}: ${value}`);
      }
    }
  }
  return {
    ok: true,
    title: 'Sức khỏe tenant',
    detail:
      counts.length > 0
        ? `Các chỉ số đã sanitize: ${counts.slice(0, 6).join(' · ')}.`
        : 'Máy chủ trả phản hồi OK (chỉ số đã được sanitize).',
    rawJson,
  };
}

function noticeOkCopy(value: unknown): string {
  const body = asRecord(value);
  if (!body) return 'Thao tác platform đã thành công.';
  if (typeof body.tenantId === 'string' && typeof body.ownerInviteId === 'string') {
    return `Đã tạo tenant ${body.tenantId} (PENDING) — lời mời owner ${body.ownerInviteId}.`;
  }
  if (typeof body.grantId === 'string') {
    return `Đã cấp support grant ${body.grantId}${
      typeof body.expiresAt === 'string' ? ` · hết hạn ${body.expiresAt}` : ''
    }.`;
  }
  if (typeof body.operator === 'boolean') {
    return body.operator
      ? 'Phiên operator hợp lệ.'
      : 'Phiên không phải operator platform.';
  }
  return 'Thao tác platform đã thành công.';
}

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
  const [health, setHealth] = useState<HealthSummary | null>(null);
  const [statusReason, setStatusReason] = useState('ops');
  const [manageNotice, setManageNotice] = useState<string | null>(null);
  const [mePhase, setMePhase] = useState<'idle' | 'loading' | 'ready'>(
    misconfigured ? 'idle' : 'loading',
  );

  useEffect(() => {
    if (misconfigured) return;
    void (async () => {
      setMePhase('loading');
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
      setMePhase('ready');
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
          Đăng nhập platform chưa sẵn sàng — console đóng an toàn, không giả lập
          MFA hay quyền operator.
        </p>
        <details className="redeem-meta">
          <summary>Chi tiết kỹ thuật</summary>
          <p>
            Fail closed — thiếu PLATFORM_OIDC_CLIENT_ID / SECRET / REDIRECT_URI /
            AUDIENCE / REQUIRED_ACR.
          </p>
        </details>
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
      {mePhase === 'loading' ? (
        <SurfaceState
          kind="loading"
          title="Đang tải phiên platform…"
          detail="Kiểm tra operator / MFA assurance qua BFF."
          testId="platform-me-loading"
        />
      ) : null}
      {mePhase === 'ready' && !me ? (
        <SurfaceState
          kind="empty"
          title="Chưa có phiên platform"
          detail="Đăng nhập platform (MFA) để xem operator và chạy lệnh."
          testId="platform-me-empty"
        />
      ) : null}
      {mePhase === 'ready' && me && me.kind !== 'ok' ? (
        <SurfaceState
          kind="error"
          title="Không đọc được phiên platform"
          detail={viewLabel(me)}
          testId="platform-me-error"
        />
      ) : null}
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
          Cần xác thực đa yếu tố — phiên chưa đủ bảo đảm. Máy chủ sẽ từ chối lệnh
          operator cho đến khi đăng nhập lại với MFA.
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
          {busy ? 'Đang xử lý…' : 'Tạo tenant'}
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
                setHealth(
                  summarizeHealth(
                    result.status,
                    result.json,
                    result.networkError,
                    result.timedOut,
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
                    ? 'Đã tạm ngưng tenant (vé/cổng/recovery vẫn dùng được).'
                    : 'Không đổi trạng thái sang tạm ngưng. Thử lại hoặc tải lại detail.',
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
                    ? 'Đã kích hoạt tenant.'
                    : 'Không kích hoạt được tenant. Thử lại hoặc tải lại detail.',
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
                    ? 'Hạn mức / cờ đã cập nhật (null = không giới hạn).'
                    : 'Không cập nhật được hạn mức. Thử lại hoặc tải lại detail.',
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
        {health ? (
          <section
            className={
              health.ok ? 'notice' : 'redeem-status redeem-status--error'
            }
            role="status"
            data-testid="platform-health"
          >
            <h3>{health.title}</h3>
            <p>{health.detail}</p>
            {health.rawJson ? (
              <details className="redeem-meta">
                <summary>JSON kỹ thuật (operator)</summary>
                <pre className="me-result" tabIndex={0} aria-label="Health JSON">
                  {health.rawJson}
                </pre>
              </details>
            ) : null}
          </section>
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
              ? noticeOkCopy(notice.value)
              : viewLabel(notice)}
          </p>
        </section>
      ) : null}
    </div>
  );
}
