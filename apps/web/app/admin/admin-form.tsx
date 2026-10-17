'use client';

import { useEffect, useState } from 'react';
import {
  createEventLabel,
  eventListLabel,
  interpretCreateEvent,
  interpretEventList,
  type CreateEventView,
  type EventListView,
} from '../../src/admin/create-event';
import type { MeTenantItem } from '../../src/platform/contracts';
import { interpretMeTenants } from '../../src/platform/shape';
import { TenantStaffPanel } from './tenant-staff';
import {
  csViewLabel,
  interpretCsDetail,
  interpretCsList,
  interpretCsResend,
  type CsView,
} from '../../src/admin/cs';
import {
  adminDecisionLabel,
  decideAdmin,
  type AdminAction,
  type AdminDecision,
} from '../../src/admin/decide';
import {
  exportViewLabel,
  interpretExportCreate,
  interpretExportDownload,
  interpretExportStatus,
  type ExportView,
} from '../../src/admin/export-job';
import {
  interpretSourceCreate,
  interpretTicketTypeCreate,
  sourceLabel,
  ticketTypeLabel,
  type SourceView,
  type TicketTypeView,
} from '../../src/admin/event-setup';
import {
  TICKET_STATES,
  interpretEventReport,
  reportShowsNumbers,
  type EventReportView,
} from '../../src/admin/report';
import {
  editConfigPayload,
  initialPayloadEditor,
  lockPublishedPayload,
  payloadLocked,
  previewConfigJson,
  startNewConfigDraft,
  type PayloadEditor,
} from '../../src/admin/payload';
import { fetchJson } from '../../src/redeem/fetch-json';
import { REQUEST_TIMEOUT_MS } from '../../src/redeem/poll-operation';

type Props = { initialTenantId?: string; initialEventId?: string };

type UnclearAttempt = { key: string; fingerprint: string; unclear: boolean };

function reuseUnclearKey(
  existing: UnclearAttempt | null,
  fingerprint: string,
): string {
  if (
    existing?.unclear &&
    existing.fingerprint === fingerprint &&
    existing.key
  ) {
    return existing.key;
  }
  return crypto.randomUUID();
}

export function AdminForm({
  initialTenantId = '',
  initialEventId = '',
}: Props) {
  const [tenantId, setTenantId] = useState(initialTenantId);
  const [eventId, setEventId] = useState(initialEventId);
  const [eventSlug, setEventSlug] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventTimezone, setEventTimezone] = useState('Asia/Ho_Chi_Minh');
  const [editor, setEditor] = useState<PayloadEditor>(() =>
    initialPayloadEditor(),
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [expectedVersion, setExpectedVersion] = useState('');
  const [codesText, setCodesText] = useState('');
  const [eventQuota, setEventQuota] = useState('');
  const [requestId, setRequestId] = useState('');
  const [denyReason, setDenyReason] = useState('');
  const [csQuery, setCsQuery] = useState('');
  const [csTicketId, setCsTicketId] = useState('');
  const [csCursor, setCsCursor] = useState<string | null>(null);
  const [exportId, setExportId] = useState('');
  const [ticketTypeLabelInput, setTicketTypeLabelInput] = useState('GA');
  const [ticketTypeId, setTicketTypeId] = useState('');
  const [sourceName, setSourceName] = useState('Invite');
  const [approvalMode, setApprovalMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [approveAttempt, setApproveAttempt] = useState<UnclearAttempt | null>(
    null,
  );
  const [denyAttempt, setDenyAttempt] = useState<UnclearAttempt | null>(null);
  const [resendAttempt, setResendAttempt] = useState<UnclearAttempt | null>(
    null,
  );
  const [exportAttempt, setExportAttempt] = useState<UnclearAttempt | null>(
    null,
  );
  const [createAttempt, setCreateAttempt] = useState<UnclearAttempt | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [noticeSeq, setNoticeSeq] = useState(0);
  const [tenantChoices, setTenantChoices] = useState<MeTenantItem[]>([]);
  const [tenantsLoadError, setTenantsLoadError] = useState<string | null>(null);
  const [decision, setDecision] = useState<AdminDecision | null>(null);
  const [createView, setCreateView] = useState<CreateEventView | null>(null);
  const [listView, setListView] = useState<EventListView | null>(null);
  const [ticketTypeView, setTicketTypeView] = useState<TicketTypeView | null>(
    null,
  );
  const [sourceView, setSourceView] = useState<SourceView | null>(null);
  const [csView, setCsView] = useState<CsView | null>(null);
  const [exportView, setExportView] = useState<ExportView | null>(null);
  const [report, setReport] = useState<EventReportView | null>(null);
  const locked = payloadLocked(editor);
  const selectedTenant = tenantChoices.find((t) => t.tenantId === tenantId.trim());
  const tenantSuspended = selectedTenant?.status === 'SUSPENDED';

  useEffect(() => {
    void (async () => {
      const result = await fetchJson(
        '/api/bff/me/tenants',
        { method: 'GET' },
        REQUEST_TIMEOUT_MS,
      );
      const view = interpretMeTenants(
        result.status,
        result.json,
        result.networkError || result.timedOut,
      );
      if (view.kind === 'ok') {
        setTenantChoices(view.value.items);
        setTenantsLoadError(null);
        if (!tenantId.trim() && view.value.items.length === 1) {
          setTenantId(view.value.items[0]!.tenantId);
        }
      } else if (view.kind === 'rejected') {
        setTenantsLoadError(`${view.code}: ${view.message}`);
      } else {
        setTenantsLoadError(view.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  function clearSpecialViews() {
    setCreateView(null);
    setListView(null);
    setTicketTypeView(null);
    setSourceView(null);
    setCsView(null);
    setExportView(null);
  }

  function bumpNotice() {
    setNoticeSeq((n) => n + 1);
  }

  async function call(action: AdminAction, path: string, init: RequestInit) {
    setBusy(true);
    setDecision(null);
    clearSpecialViews();
    const result = await fetchJson(path, init, REQUEST_TIMEOUT_MS);
    const next = decideAdmin(
      action,
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    if (next.kind === 'saved') setExpectedVersion(String(next.version));
    if (next.kind === 'published') {
      setEditor((prev) => lockPublishedPayload(prev));
      setExpectedVersion(String(next.version));
    }
    bumpNotice();
    setDecision(next);
    setBusy(false);
  }

  function scope() {
    return { tenantId: tenantId.trim(), eventId: eventId.trim() };
  }

  function showPreview() {
    const parsed = previewConfigJson(editor.text);
    if (!parsed.ok) {
      setPreview(null);
      setDecision({
        kind: 'rejected',
        code: parsed.code,
        message: parsed.message,
      });
      return;
    }
    setPreview(parsed.pretty);
  }

  async function saveConfig() {
    const parsed = previewConfigJson(editor.text);
    if (!parsed.ok) {
      setDecision({
        kind: 'rejected',
        code: parsed.code,
        message: parsed.message,
      });
      return;
    }
    await call('save', '/api/bff/admin/config-versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...scope(),
        payload: JSON.parse(editor.text) as unknown,
      }),
    });
  }

  async function publish() {
    const version = Number(expectedVersion);
    await call('publish', '/api/bff/admin/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...scope(), expectedVersion: version }),
    });
  }

  async function importCodes() {
    const codes = codesText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const quota = eventQuota.trim() === '' ? undefined : Number(eventQuota);
    await call('import', '/api/bff/admin/imports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...scope(),
        codes,
        ...(quota ? { eventQuota: quota } : {}),
      }),
    });
  }

  async function loadQuota() {
    const params = new URLSearchParams(scope());
    await call('quota', `/api/bff/admin/quota?${params.toString()}`, {
      method: 'GET',
    });
  }

  async function loadReport() {
    setBusy(true);
    setReport(null);
    setDecision(null);
    clearSpecialViews();
    const params = new URLSearchParams(scope());
    const result = await fetchJson(
      `/api/bff/admin/report?${params.toString()}`,
      { method: 'GET' },
      REQUEST_TIMEOUT_MS,
    );
    bumpNotice();
    setReport(
      interpretEventReport(
        result.status,
        result.json,
        result.networkError || result.timedOut,
      ),
    );
    setBusy(false);
  }

  async function listEvents() {
    setBusy(true);
    setDecision(null);
    clearSpecialViews();
    const params = new URLSearchParams({ tenantId: tenantId.trim() });
    const result = await fetchJson(
      `/api/bff/admin/events?${params.toString()}`,
      { method: 'GET' },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretEventList(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    bumpNotice();
    setListView(next);
    setBusy(false);
  }

  async function createEvent() {
    const fingerprint = JSON.stringify({
      tenantId: tenantId.trim(),
      slug: eventSlug.trim(),
      name: eventName.trim(),
      timezone: eventTimezone.trim() || undefined,
    });
    const idempotencyKey = reuseUnclearKey(createAttempt, fingerprint);
    setBusy(true);
    setDecision(null);
    clearSpecialViews();
    const result = await fetchJson(
      '/api/bff/admin/events',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenantId.trim(),
          slug: eventSlug.trim(),
          name: eventName.trim(),
          timezone: eventTimezone.trim() || undefined,
          idempotencyKey,
        }),
      },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretCreateEvent(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setCreateAttempt({
      key: idempotencyKey,
      fingerprint,
      unclear: next.kind === 'unknown',
    });
    if (next.kind === 'created') setEventId(next.eventId);
    bumpNotice();
    setCreateView(next);
    setBusy(false);
  }

  async function createTicketType() {
    setBusy(true);
    setDecision(null);
    clearSpecialViews();
    const result = await fetchJson(
      '/api/bff/admin/ticket-types',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scope(),
          label: ticketTypeLabelInput.trim(),
        }),
      },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretTicketTypeCreate(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    if (next.kind === 'created') setTicketTypeId(next.ticketTypeId);
    bumpNotice();
    setTicketTypeView(next);
    setBusy(false);
  }

  async function createSource() {
    setBusy(true);
    setDecision(null);
    clearSpecialViews();
    const result = await fetchJson(
      '/api/bff/admin/sources',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scope(),
          name: sourceName.trim(),
          approvalMode,
          ticketTypeId: ticketTypeId.trim(),
        }),
      },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretSourceCreate(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    bumpNotice();
    setSourceView(next);
    setBusy(false);
  }

  async function csSearch() {
    setBusy(true);
    setDecision(null);
    clearSpecialViews();
    const params = new URLSearchParams({
      ...scope(),
      ...(csQuery.trim() ? { q: csQuery.trim() } : {}),
      limit: '20',
      ...(csCursor ? { cursor: csCursor } : {}),
    });
    const result = await fetchJson(
      `/api/bff/admin/tickets?${params.toString()}`,
      { method: 'GET' },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretCsList(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    if (next.kind === 'list') setCsCursor(next.cursor);
    bumpNotice();
    setCsView(next);
    setBusy(false);
  }

  async function csDetail() {
    const id = csTicketId.trim();
    if (!id) {
      setCsView({
        kind: 'rejected',
        code: 'TICKET_ID_REQUIRED',
        message: 'ticketId must be a UUID.',
      });
      return;
    }
    setBusy(true);
    setDecision(null);
    clearSpecialViews();
    const params = new URLSearchParams(scope());
    const result = await fetchJson(
      `/api/bff/admin/tickets/${encodeURIComponent(id)}?${params.toString()}`,
      { method: 'GET' },
      REQUEST_TIMEOUT_MS,
    );
    bumpNotice();
    setCsView(
      interpretCsDetail(
        result.status,
        result.json,
        result.networkError || result.timedOut,
        id,
      ),
    );
    setBusy(false);
  }

  async function csResend() {
    const id = csTicketId.trim();
    if (!id) {
      setCsView({
        kind: 'rejected',
        code: 'TICKET_ID_REQUIRED',
        message: 'ticketId must be a UUID.',
      });
      return;
    }
    const fingerprint = JSON.stringify({ ...scope(), ticketId: id });
    const idempotencyKey = reuseUnclearKey(resendAttempt, fingerprint);
    setBusy(true);
    setDecision(null);
    clearSpecialViews();
    const result = await fetchJson(
      `/api/bff/admin/tickets/${encodeURIComponent(id)}/resend`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scope(), idempotencyKey }),
      },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretCsResend(
      result.status,
      result.json,
      result.networkError || result.timedOut,
      id,
    );
    setResendAttempt({
      key: idempotencyKey,
      fingerprint,
      unclear: next.kind === 'unknown',
    });
    bumpNotice();
    setCsView(next);
    setBusy(false);
  }

  async function createExport() {
    const fingerprint = JSON.stringify({ ...scope(), format: 'csv' });
    const idempotencyKey = reuseUnclearKey(exportAttempt, fingerprint);
    setBusy(true);
    setDecision(null);
    clearSpecialViews();
    const result = await fetchJson(
      '/api/bff/admin/exports',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scope(),
          format: 'csv',
          idempotencyKey,
        }),
      },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretExportCreate(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setExportAttempt({
      key: idempotencyKey,
      fingerprint,
      unclear: next.kind === 'unknown',
    });
    if (next.kind === 'created') setExportId(next.job.exportId);
    bumpNotice();
    setExportView(next);
    setBusy(false);
  }

  async function loadExportStatus() {
    const id = exportId.trim();
    if (!id) {
      setExportView({
        kind: 'rejected',
        code: 'EXPORT_ID_REQUIRED',
        message: 'exportId must be a UUID.',
      });
      return;
    }
    setBusy(true);
    setDecision(null);
    clearSpecialViews();
    const params = new URLSearchParams(scope());
    const result = await fetchJson(
      `/api/bff/admin/exports/${encodeURIComponent(id)}?${params.toString()}`,
      { method: 'GET' },
      REQUEST_TIMEOUT_MS,
    );
    bumpNotice();
    setExportView(
      interpretExportStatus(
        result.status,
        result.json,
        result.networkError || result.timedOut,
        id,
      ),
    );
    setBusy(false);
  }

  async function downloadExport() {
    const id = exportId.trim();
    if (!id) {
      setExportView({
        kind: 'rejected',
        code: 'EXPORT_ID_REQUIRED',
        message: 'exportId must be a UUID.',
      });
      return;
    }
    setBusy(true);
    setDecision(null);
    clearSpecialViews();
    const params = new URLSearchParams(scope());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(
        `/api/bff/admin/exports/${encodeURIComponent(id)}/download?${params.toString()}`,
        {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        },
      );
      const contentType = response.headers.get('Content-Type');
      const disposition = response.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="([^"]+)"/);
      if ((contentType ?? '').includes('application/json')) {
        const json = (await response.json()) as unknown;
        bumpNotice();
        setExportView(
          interpretExportDownload(
            response.status,
            json,
            false,
            id,
            contentType,
          ),
        );
      } else {
        const buf = await response.arrayBuffer();
        const filename = filenameMatch?.[1] ?? `export-${id}.csv`;
        const view = interpretExportDownload(
          response.status,
          null,
          false,
          id,
          contentType,
          buf.byteLength,
          filenameMatch?.[1] ?? null,
        );
        if (view.kind === 'download') {
          const blob = new Blob([buf], {
            type: contentType ?? 'text/csv',
          });
          const objectUrl = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = objectUrl;
          anchor.download = filename;
          anchor.rel = 'noopener';
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(objectUrl);
        }
        bumpNotice();
        setExportView(view);
      }
    } catch {
      bumpNotice();
      setExportView(
        interpretExportDownload(0, null, true, id, null),
      );
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  async function decideRedemption(action: 'approve' | 'deny') {
    const id = requestId.trim();
    if (!id) {
      setDecision({
        kind: 'rejected',
        code: 'REQUEST_ID_REQUIRED',
        message: 'requestId must be a UUID.',
      });
      return;
    }
    const reason = denyReason.trim();
    if (action === 'deny' && !reason) {
      setDecision({
        kind: 'rejected',
        code: 'REASON_REQUIRED',
        message: 'Denial reason is required.',
      });
      return;
    }
    if (action === 'deny' && reason.length > 500) {
      setDecision({
        kind: 'rejected',
        code: 'REASON_TOO_LONG',
        message: 'Denial reason must be at most 500 characters.',
      });
      return;
    }
    const fingerprint = JSON.stringify({
      ...scope(),
      requestId: id,
      reason: action === 'deny' ? reason : '',
    });
    const existing = action === 'approve' ? approveAttempt : denyAttempt;
    const idempotencyKey = reuseUnclearKey(existing, fingerprint);
    const remember = (unclear: boolean) => {
      const next = { key: idempotencyKey, fingerprint, unclear };
      if (action === 'approve') setApproveAttempt(next);
      else setDenyAttempt(next);
    };
    setBusy(true);
    setDecision(null);
    setCreateView(null);
    setCsView(null);
    setExportView(null);
    const result = await fetchJson(
      action === 'approve'
        ? '/api/bff/admin/redemptions/approve'
        : '/api/bff/admin/redemptions/deny',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scope(),
          requestId: id,
          idempotencyKey,
          ...(action === 'deny' ? { reason } : {}),
        }),
      },
      REQUEST_TIMEOUT_MS,
    );
    const next = decideAdmin(
      action,
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    remember(next.kind === 'unknown');
    bumpNotice();
    setDecision(next);
    setBusy(false);
  }

  return (
    <div className="redeem-form">
      <div className="redeem-fields">
        <label>
          Tenant (từ /me/tenants)
          <select
            name="tenantSelector"
            data-testid="tenant-selector"
            value={
              tenantChoices.some((t) => t.tenantId === tenantId.trim())
                ? tenantId.trim()
                : ''
            }
            onChange={(e) => setTenantId(e.target.value)}
          >
            <option value="">— chọn tenant —</option>
            {tenantChoices.map((t) => (
              <option key={t.tenantId} value={t.tenantId}>
                {t.slug} · {t.name} ({t.status}/{t.role})
              </option>
            ))}
          </select>
        </label>
        <label>
          Tenant ID (fallback / UAT)
          <input
            name="tenantId"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </label>
        <label>
          Event ID
          <input
            name="eventId"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </label>
      </div>
      {tenantsLoadError ? (
        <p className="intro" role="status">
          Selector /me/tenants: {tenantsLoadError}. Dùng ô Tenant ID tạm khi BE
          platform chưa sẵn sàng; vận hành thật ưu tiên selector.
        </p>
      ) : (
        <p className="intro">
          Tenant discovery qua selector (không coi ô UUID là đường vận hành
          chính). Event, ticket type và source tạo qua API/UI thật.
        </p>
      )}
      {tenantSuspended ? (
        <aside className="notice" role="status" data-testid="suspend-banner">
          <strong>Tenant SUSPENDED</strong>
          <p>
            Admin mutations bị chặn. Vé đã phát / Gate / recovery vẫn dùng được.
            Backend vẫn enforce — UI chỉ cảnh báo.
          </p>
        </aside>
      ) : null}
      <TenantStaffPanel tenantId={tenantId} />
      <section aria-labelledby="create-event-heading">
        <h2 id="create-event-heading">Tạo / liệt kê event trong tenant</h2>
        <p>
          POST create kèm Idempotency-Key. Shape sai → chưa biết, không coi là
          đã tạo.
        </p>
        <label>
          Event slug
          <input
            name="eventSlug"
            value={eventSlug}
            onChange={(e) => setEventSlug(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="my-event-2026"
          />
        </label>
        <label>
          Event name
          <input
            name="eventName"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Timezone
          <input
            name="eventTimezone"
            value={eventTimezone}
            onChange={(e) => setEventTimezone(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="auth-buttons">
          <button
            type="button"
            disabled={busy}
            onClick={() => void createEvent()}
          >
            Tạo event
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void listEvents()}
          >
            Liệt kê event
          </button>
        </div>
        {listView?.kind === 'list' ? (
          <ul data-testid="event-list">
            {listView.items.map((item) => (
              <li key={item.eventId}>
                <button
                  type="button"
                  onClick={() => setEventId(item.eventId)}
                >
                  {item.slug} · {item.name} ({item.status})
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section aria-labelledby="type-source-heading">
        <h2 id="type-source-heading">Ticket type &amp; source</h2>
        <p>
          Mapping type → source bắt buộc trước import. Không seed SQL cho
          type/source.
        </p>
        <label>
          Ticket type label
          <input
            name="ticketTypeLabel"
            value={ticketTypeLabelInput}
            onChange={(e) => setTicketTypeLabelInput(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="auth-buttons">
          <button
            type="button"
            disabled={busy}
            onClick={() => void createTicketType()}
          >
            Tạo ticket type
          </button>
        </div>
        <label>
          Ticket type ID
          <input
            name="ticketTypeId"
            value={ticketTypeId}
            onChange={(e) => setTicketTypeId(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </label>
        <label>
          Source name
          <input
            name="sourceName"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Approval mode
          <select
            name="approvalMode"
            value={approvalMode}
            onChange={(e) =>
              setApprovalMode(e.target.value === 'MANUAL' ? 'MANUAL' : 'AUTO')
            }
          >
            <option value="AUTO">AUTO</option>
            <option value="MANUAL">MANUAL</option>
          </select>
        </label>
        <div className="auth-buttons">
          <button
            type="button"
            disabled={busy}
            onClick={() => void createSource()}
          >
            Tạo source
          </button>
        </div>
      </section>
      <section aria-labelledby="event-report-heading">
        <h2 id="event-report-heading">Báo cáo sự kiện</h2>
        <p>
          Chỉ đọc: số vé theo trạng thái, quota capacity/allocated, và số yêu
          cầu chờ duyệt. Lỗi máy chủ, timeout hoặc mất mạng là chưa biết — các
          số đó không được hiện.
        </p>
        <div className="auth-buttons">
          <button
            type="button"
            disabled={busy}
            onClick={() => void loadReport()}
          >
            Tải báo cáo
          </button>
        </div>
        {report && reportShowsNumbers(report) ? (
          <dl data-testid="event-report-numbers">
            {TICKET_STATES.map((state) => (
              <div key={state}>
                <dt>{state}</dt>
                <dd>{report.ticketsByState[state]}</dd>
              </div>
            ))}
            <div>
              <dt>Quota capacity</dt>
              <dd>
                {report.quota.capacity === null
                  ? 'null'
                  : report.quota.capacity}
              </dd>
            </div>
            <div>
              <dt>Quota allocated</dt>
              <dd>{report.quota.allocated}</dd>
            </div>
            <div>
              <dt>Chờ duyệt</dt>
              <dd>{report.pendingApprovalCount}</dd>
            </div>
          </dl>
        ) : null}
        {report && !reportShowsNumbers(report) ? (
          <p data-testid="event-report-unknown" role="status">
            {report.kind === 'rejected'
              ? `${report.code}: ${report.message}`
              : report.message}
          </p>
        ) : null}
      </section>
      <label>
        Payload cấu hình (JSON)
        <textarea
          id="admin-payload"
          value={editor.text}
          readOnly={locked}
          aria-readonly={locked}
          onChange={(e) =>
            setEditor((prev) => editConfigPayload(prev, e.target.value))
          }
          rows={6}
          spellCheck={false}
        />
      </label>
      <div className="auth-buttons">
        <button type="button" disabled={busy} onClick={showPreview}>
          Xem trước
        </button>
        <button
          type="button"
          disabled={busy || locked}
          onClick={() => void saveConfig()}
        >
          Lưu phiên bản
        </button>
      </div>
      {preview ? (
        <pre id="config-preview" className="me-result" tabIndex={0}>
          {preview}
        </pre>
      ) : null}
      <label>
        Phiên bản cần publish
        <input
          value={expectedVersion}
          onChange={(e) => setExpectedVersion(e.target.value)}
          inputMode="numeric"
          readOnly={locked}
        />
      </label>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy || locked}
          onClick={() => void publish()}
        >
          Publish
        </button>
        {locked ? (
          <button
            type="button"
            onClick={() => setEditor((prev) => startNewConfigDraft(prev))}
          >
            Soạn bản mới
          </button>
        ) : null}
      </div>
      {editor.publishedSnapshot ? (
        <div>
          <h3>Payload đã publish (chỉ đọc)</h3>
          <pre id="admin-published" className="me-result" tabIndex={0}>
            {editor.publishedSnapshot}
          </pre>
        </div>
      ) : null}
      <label>
        Mã mời, mỗi dòng một mã
        <textarea
          id="admin-codes"
          value={codesText}
          onChange={(e) => setCodesText(e.target.value)}
          rows={5}
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      <label>
        Quota event (lần nhập đầu)
        <input
          name="eventQuota"
          value={eventQuota}
          onChange={(e) => setEventQuota(e.target.value)}
          inputMode="numeric"
        />
      </label>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy}
          onClick={() => void importCodes()}
        >
          Nhập mã
        </button>
        <button type="button" disabled={busy} onClick={() => void loadQuota()}>
          Đọc quota
        </button>
      </div>
      <h2>Duyệt yêu cầu đổi mã</h2>
      <label>
        Request ID đang chờ
        <input
          name="requestId"
          value={requestId}
          onChange={(e) => setRequestId(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        />
      </label>
      <label>
        Lý do từ chối
        <textarea
          id="admin-deny-reason"
          value={denyReason}
          onChange={(e) => setDenyReason(e.target.value)}
          rows={3}
          maxLength={500}
          required
        />
      </label>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy}
          onClick={() => void decideRedemption('approve')}
        >
          Duyệt
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void decideRedemption('deny')}
        >
          Từ chối
        </button>
      </div>
      <section aria-labelledby="cs-heading">
        <h2 id="cs-heading">CS — tra cứu và gửi lại email</h2>
        <p>
          PII mặc định đã che trên API. Trạng thái provider ACCEPTED không được
          hiểu là đã giao email.
        </p>
        <label>
          Từ khóa CS
          <input
            name="csQuery"
            value={csQuery}
            onChange={(e) => {
              setCsQuery(e.target.value);
              setCsCursor(null);
            }}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="auth-buttons">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setCsCursor(null);
              void csSearch();
            }}
          >
            Tìm vé CS
          </button>
          {csCursor ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void csSearch()}
            >
              Trang CS tiếp
            </button>
          ) : null}
        </div>
        <label>
          Ticket ID
          <input
            name="csTicketId"
            value={csTicketId}
            onChange={(e) => setCsTicketId(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </label>
        <div className="auth-buttons">
          <button type="button" disabled={busy} onClick={() => void csDetail()}>
            Xem chi tiết CS
          </button>
          <button type="button" disabled={busy} onClick={() => void csResend()}>
            Gửi lại email
          </button>
        </div>
        {csView?.kind === 'list' ? (
          <pre
            data-testid="cs-list"
            className="me-result"
            tabIndex={0}
            aria-label="CS list"
          >
            {JSON.stringify(csView.items, null, 2)}
          </pre>
        ) : null}
        {csView?.kind === 'detail' ? (
          <div data-testid="cs-detail">
            <pre className="me-result" tabIndex={0} aria-label="CS detail">
              {JSON.stringify(
                {
                  ticketId: csView.ticket.ticketId,
                  state: csView.ticket.state,
                  ownerEmailMasked: csView.ticket.ownerEmailMasked,
                  notification: csView.ticket.notification,
                },
                null,
                2,
              )}
            </pre>
            <ol data-testid="cs-timeline" aria-label="CS timeline">
              {csView.ticket.timeline.map((item) => (
                <li key={`${item.at}-${item.kind}-${item.summary}`}>
                  {item.at} · {item.kind}: {item.summary}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </section>
      <section aria-labelledby="export-heading">
        <h2 id="export-heading">Export CSV</h2>
        <p>
          Job nền + link tải có hạn (MinIO private). Không lưu URL dài hạn trên
          form.
        </p>
        <div className="auth-buttons">
          <button
            type="button"
            disabled={busy}
            onClick={() => void createExport()}
          >
            Tạo export CSV
          </button>
        </div>
        <label>
          Export ID
          <input
            name="exportId"
            value={exportId}
            onChange={(e) => setExportId(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </label>
        <div className="auth-buttons">
          <button
            type="button"
            disabled={busy}
            onClick={() => void loadExportStatus()}
          >
            Trạng thái export
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void downloadExport()}
          >
            Tải CSV
          </button>
        </div>
      </section>
      {(() => {
        const notice = createView
          ? {
              error: createView.kind === 'rejected',
              text: createEventLabel(createView),
            }
          : listView
            ? {
                error: listView.kind === 'rejected',
                text: eventListLabel(listView),
              }
            : ticketTypeView
              ? {
                  error: ticketTypeView.kind === 'rejected',
                  text: ticketTypeLabel(ticketTypeView),
                }
              : sourceView
                ? {
                    error: sourceView.kind === 'rejected',
                    text: sourceLabel(sourceView),
                  }
                : csView
                  ? {
                      error: csView.kind === 'rejected',
                      text: csViewLabel(csView),
                    }
                  : exportView
                    ? {
                        error: exportView.kind === 'rejected',
                        text: exportViewLabel(exportView),
                      }
                    : decision
                      ? {
                          error: decision.kind === 'rejected',
                          text: adminDecisionLabel(decision),
                        }
                      : null;
        if (!notice) return null;
        return (
          <section
            className={
              notice.error
                ? 'redeem-status redeem-status--error'
                : 'notice'
            }
            role="alert"
            data-testid="admin-notice"
            data-notice-seq={noticeSeq}
          >
            <p>{notice.text}</p>
          </section>
        );
      })()}
    </div>
  );
}
