'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventDetail, EventVisibility } from '@ticket/contracts';
import { adminGet, adminMutate } from '../../src/admin/client-fetch';
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
import { ImportPanel } from './import-panel';
import { NotificationsPanel } from './notifications-panel';
import { TenantStaffPanel } from './tenant-staff';
import { csViewLabel } from '../../src/admin/cs';
import {
  adminDecisionLabel,
  decideAdmin,
  type AdminAction,
  type AdminDecision,
} from '../../src/admin/decide';
import { exportViewLabel } from '../../src/admin/export-job';
import {
  eventDetailLabel,
  eventImpactLabel,
  eventMutationLabel,
  interpretEventDetail,
  type EventDetailView,
} from '../../src/admin/event-lifecycle';
import { sourceLabel, ticketTypeLabel } from '../../src/admin/event-setup';
import {
  initialConfigEditor,
  lockPublishedConfig,
  type ConfigEditor,
} from '../../src/admin/config-editor';
import { fetchJson } from '../../src/redeem/fetch-json';
import { REQUEST_TIMEOUT_MS } from '../../src/redeem/poll-operation';
import { ConfigBrandPanel } from './config-brand-panel';
import { SurfaceState } from '../../src/ui/surface-state';
import {
  deriveAdminReadiness,
  readinessAllOk,
  readinessSummary,
} from '../../src/admin/readiness';
import { useAdminScope } from '../../src/admin/use-admin-scope';
import { useIdempotentAction } from '../../src/admin/use-idempotent-action';
import { useEventLifecycleApi } from '../../src/admin/use-event-lifecycle-api';
import { useTicketSourceApi } from '../../src/admin/use-ticket-source-api';
import { useRedemptionApprovalApi } from '../../src/admin/use-redemption-approval-api';
import { useCsApi } from '../../src/admin/use-cs-api';
import { useExportApi } from '../../src/admin/use-export-api';
import { useEventReportApi } from '../../src/admin/use-event-report-api';
import { EventLifecycleSection } from './event-lifecycle-section';
import { TicketSourceSection } from './ticket-source-section';
import { RedemptionApprovalSection } from './redemption-approval-section';
import { CsSection } from './cs-section';
import { ExportSection } from './export-section';
import { EventReportSection } from './event-report-section';
import { AdminReadinessAside } from './admin-readiness-aside';
import { AdminStatsBar } from './admin-stats-bar';

type Props = { initialTenantId?: string; initialEventId?: string };

type AdminJob = 'setup' | 'guests' | 'gate' | 'support';

const ADMIN_JOBS: { id: AdminJob; label: string }[] = [
  { id: 'setup', label: 'Chuẩn bị' },
  { id: 'guests', label: 'Khách & mã' },
  { id: 'gate', label: 'Cổng' },
  { id: 'support', label: 'Hỗ trợ' },
];

export function AdminForm({
  initialTenantId = '',
  initialEventId = '',
}: Props) {
  const { tenantId, setTenantId, eventId, setEventId, scope } = useAdminScope({
    tenantId: initialTenantId,
    eventId: initialEventId,
  });
  const [eventSlug, setEventSlug] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventTimezone, setEventTimezone] = useState('Asia/Ho_Chi_Minh');
  const [configEditor, setConfigEditor] = useState<ConfigEditor>(() =>
    initialConfigEditor(),
  );
  const [expectedVersion, setExpectedVersion] = useState('');
  const [configNotice, setConfigNotice] = useState<string | null>(null);
  const [codesText, setCodesText] = useState('');
  const [eventQuota, setEventQuota] = useState('');
  const createIdempotency = useIdempotentAction();
  const [busy, setBusy] = useState(false);
  const [noticeSeq, setNoticeSeq] = useState(0);
  const [tenantChoices, setTenantChoices] = useState<MeTenantItem[]>([]);
  const [tenantsLoadError, setTenantsLoadError] = useState<string | null>(null);
  const [tenantsPhase, setTenantsPhase] = useState<'loading' | 'ready'>('loading');
  const [decision, setDecision] = useState<AdminDecision | null>(null);
  const [lastQuotaDecision, setLastQuotaDecision] = useState<Extract<
    AdminDecision,
    { kind: 'quota' }
  > | null>(null);
  const [createView, setCreateView] = useState<CreateEventView | null>(null);
  const [listView, setListView] = useState<EventListView | null>(null);
  const [detailView, setDetailView] = useState<EventDetailView | null>(null);
  const [metaVisibility, setMetaVisibility] =
    useState<EventVisibility>('UNLISTED');
  const [metaStartsAt, setMetaStartsAt] = useState('');
  const [metaEndsAt, setMetaEndsAt] = useState('');
  const [metaVenueName, setMetaVenueName] = useState('');
  const [metaVenueAddress, setMetaVenueAddress] = useState('');
  const [metaContactEmail, setMetaContactEmail] = useState('');
  const [metaRedeemOpen, setMetaRedeemOpen] = useState('');
  const [metaRedeemClose, setMetaRedeemClose] = useState('');
  const [metaCheckInOpen, setMetaCheckInOpen] = useState('');
  const [metaCheckInClose, setMetaCheckInClose] = useState('');
  const [metaMaxTickets, setMetaMaxTickets] = useState('');
  const [confirmIssuedImpact, setConfirmIssuedImpact] = useState(false);
  const [notifyAttendees, setNotifyAttendees] = useState(false);
  const [cloneSlug, setCloneSlug] = useState('');
  const [cloneName, setCloneName] = useState('');
  const [copyConfig, setCopyConfig] = useState(true);
  const [cancelReason, setCancelReason] = useState('');
  const [activeJob, setActiveJob] = useState<AdminJob>('setup');
  const [browserOnline, setBrowserOnline] = useState(true);

  const clearSpecialViewsRef = useRef<() => void>(() => {});
  const onClearSiblingViews = useCallback(() => {
    clearSpecialViewsRef.current();
  }, []);

  const bumpNotice = useCallback(() => {
    setNoticeSeq((n) => n + 1);
  }, []);

  const applyEventToEditor = useCallback((event: EventDetail) => {
    setEventId(event.eventId);
    setEventSlug(event.slug);
    setEventName(event.name);
    setEventTimezone(event.timezone);
    setMetaVisibility(event.visibility);
    setMetaStartsAt(event.startsAt ?? '');
    setMetaEndsAt(event.endsAt ?? '');
    setMetaVenueName(event.venue?.name ?? '');
    setMetaVenueAddress(event.venue?.address ?? '');
    setMetaContactEmail(event.contact?.email ?? '');
    setMetaRedeemOpen(event.redemptionWindow.opensAt ?? '');
    setMetaRedeemClose(event.redemptionWindow.closesAt ?? '');
    setMetaCheckInOpen(event.checkInWindow.opensAt ?? '');
    setMetaCheckInClose(event.checkInWindow.closesAt ?? '');
    setMetaMaxTickets(
      event.maxTicketsPerAttendee === null
        ? ''
        : String(event.maxTicketsPerAttendee),
    );
    setConfirmIssuedImpact(false);
    setCloneSlug(`${event.slug}-copy`);
    setCloneName(`${event.name} (copy)`);
  }, [setEventId]);

  const onBeforeLifecycleMutate = useCallback(() => {
    setCreateView(null);
    setListView(null);
    setDecision(null);
  }, []);

  const currentEvent: EventDetail | null =
    detailView?.kind === 'detail' ? detailView.event : null;

  const lifecycleApi = useEventLifecycleApi({
    tenantId,
    eventId,
    currentEvent,
    meta: {
      metaStartsAt,
      metaEndsAt,
      metaVenueName,
      metaVenueAddress,
      metaContactEmail,
      metaRedeemOpen,
      metaRedeemClose,
      metaCheckInOpen,
      metaCheckInClose,
      metaMaxTickets,
      metaVisibility,
      eventName,
      eventTimezone,
    },
    confirmIssuedImpact,
    notifyAttendees,
    cloneSlug,
    cloneName,
    copyConfig,
    cancelReason,
    setConfirmIssuedImpact,
    applyEventToEditor,
    setDetailView,
    onBusy: setBusy,
    onBumpNotice: bumpNotice,
    onBeforeLifecycleMutate,
  });

  const ticketSourceApi = useTicketSourceApi({
    scope,
    onBusy: setBusy,
    onBumpNotice: bumpNotice,
    onClearSiblingViews,
    onTicketTypeCreated: () => {},
    onSourceCreated: () => {},
  });

  const csApi = useCsApi({
    scope,
    onBusy: setBusy,
    onBumpNotice: bumpNotice,
    onClearSiblingViews,
  });

  const exportApi = useExportApi({
    scope,
    onBusy: setBusy,
    onBumpNotice: bumpNotice,
    onClearSiblingViews,
  });

  const redemptionApi = useRedemptionApprovalApi({
    scope,
    onBusy: setBusy,
    onBumpNotice: bumpNotice,
    onDecision: setDecision,
    onBeforeRedemption: () => {
      setCreateView(null);
      csApi.clearViews();
      exportApi.clearViews();
    },
  });

  const eventReportApi = useEventReportApi({
    tenantId,
    eventId,
    scope,
    onBusy: setBusy,
    onBumpNotice: bumpNotice,
    onClearSiblingViews,
    onClearDecision: () => setDecision(null),
  });

  useEffect(() => {
    clearSpecialViewsRef.current = () => {
      setCreateView(null);
      setListView(null);
      lifecycleApi.clearViews();
      ticketSourceApi.clearViews();
      csApi.clearViews();
      exportApi.clearViews();
      eventReportApi.clearReport();
    };
  }, [
    csApi,
    eventReportApi,
    exportApi,
    lifecycleApi,
    ticketSourceApi,
  ]);

  const { report } = eventReportApi;
  const {
    ticketTypeId,
    setTicketTypeId,
    sourceId,
    setSourceId,
    ticketTypeView,
    sourceView,
  } = ticketSourceApi;

  /** Switch job panel then scroll/focus the target section (O12 P3 deep-link). */
  function goToAdminSection(job: AdminJob, sectionId: string) {
    setActiveJob(job);
    window.setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (!el) return;
      if (window.location.hash !== `#${sectionId}`) {
        window.history.replaceState(null, '', `#${sectionId}`);
      }
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      el.focus({ preventScroll: true });
    }, 0);
  }

  const selectedTenant = tenantChoices.find((t) => t.tenantId === tenantId.trim());
  const tenantSuspended = selectedTenant?.status === 'SUSPENDED';
  const readinessItems = deriveAdminReadiness({
    ticketTypeId,
    sourceId,
    quotaDecision: lastQuotaDecision,
    report,
    eventQuotaInput: eventQuota,
    configPayload: configEditor.payload,
    configPublished: configEditor.publishedSnapshot != null,
    hasEventContext: Boolean(eventId.trim() || currentEvent),
  });
  const publishReady = readinessAllOk(readinessItems);
  const eventTitle =
    (currentEvent?.name || eventName.trim() || '').trim() ||
    (currentEvent?.slug || eventSlug.trim() || '').trim() ||
    null;
  const orgTitle =
    (selectedTenant?.name || '').trim() ||
    (selectedTenant?.slug || '').trim() ||
    (configEditor.payload.brand.organizationName || '').trim() ||
    null;

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
      setTenantsPhase('ready');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  useEffect(() => {
    const sync = () => setBrowserOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  function clearSpecialViews() {
    clearSpecialViewsRef.current();
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
      setConfigEditor((prev) => lockPublishedConfig(prev));
      setExpectedVersion(String(next.version));
    }
    if (next.kind === 'quota') setLastQuotaDecision(next);
    bumpNotice();
    setDecision(next);
    setBusy(false);
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
      visibility: metaVisibility,
    });
    const idempotencyKey = createIdempotency.keyFor(fingerprint);
    setBusy(true);
    setDecision(null);
    clearSpecialViews();
    const result = await adminMutate(
      '/api/bff/admin/events',
      {
        tenantId: tenantId.trim(),
        slug: eventSlug.trim(),
        name: eventName.trim(),
        timezone: eventTimezone.trim() || undefined,
        visibility: metaVisibility,
        startsAt: metaStartsAt.trim() || null,
        endsAt: metaEndsAt.trim() || null,
        venueName: metaVenueName.trim() || undefined,
        venueAddress: metaVenueAddress.trim() || undefined,
        contactEmail: metaContactEmail.trim() || undefined,
        redemptionOpensAt: metaRedeemOpen.trim() || null,
        redemptionClosesAt: metaRedeemClose.trim() || null,
        checkInOpensAt: metaCheckInOpen.trim() || null,
        checkInClosesAt: metaCheckInClose.trim() || null,
        maxTicketsPerAttendee:
          metaMaxTickets.trim() === ''
            ? null
            : Number(metaMaxTickets.trim()),
        idempotencyKey,
      },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretCreateEvent(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    createIdempotency.remember(
      idempotencyKey,
      fingerprint,
      next.kind === 'unknown',
    );
    if (next.kind === 'ok') {
      setEventId(next.event.eventId);
      applyEventToEditor(next.event);
      setDetailView({
        kind: 'detail',
        event: next.event,
        replayed: next.replayed,
      });
    }
    bumpNotice();
    setCreateView(next);
    setBusy(false);
  }

  async function selectEventContext(nextEventId: string) {
    setEventId(nextEventId);
    setBusy(true);
    setDecision(null);
    clearSpecialViews();
    setDetailView(null);
    const params = new URLSearchParams({
      tenantId: tenantId.trim(),
    });
    const result = await adminGet(
      `/api/bff/admin/events/${encodeURIComponent(nextEventId)}?${params}`,
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretEventDetail(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    if (next.kind === 'detail') applyEventToEditor(next.event);
    bumpNotice();
    setDetailView(next);
    setBusy(false);
  }

  async function loadEventDetail() {
    await selectEventContext(eventId.trim());
  }

  const { lifecycleView, impactView } = lifecycleApi;
  const { csView } = csApi;
  const { exportView } = exportApi;

  return (
    <div className="redeem-form admin-workspace" data-testid="admin-workspace">
      {!browserOnline ? (
        <aside
          className="notice state-error"
          role="alert"
          data-testid="admin-offline-banner"
        >
          <strong>Mất kết nối mạng</strong>
          <p>
            Thao tác quản trị có thể chưa rõ kết quả — không đánh dấu đã lưu /
            đã xuất bản khi request chưa xác nhận.
          </p>
        </aside>
      ) : null}
      <header className="admin-event-summary" data-testid="admin-event-summary">
        <p className="admin-event-summary__eyebrow">
          {orgTitle ? `Tổ chức · ${orgTitle}` : 'Tổ chức · chưa chọn'}
        </p>
        <h2 className="admin-event-summary__title">
          {eventTitle ?? 'Chưa chọn sự kiện'}
        </h2>
        <p className="admin-event-summary__meta muted" data-testid="current-event-context">
          {currentEvent
            ? `Trạng thái: ${currentEvent.contentStatus}/${currentEvent.businessStatus}`
            : eventId.trim()
              ? 'Đã chọn sự kiện — tải metadata nếu tên chưa hiện.'
              : 'Chọn tổ chức và sự kiện để làm việc.'}
          {selectedTenant ? ` · ${selectedTenant.role}` : ''}
        </p>
      </header>
      {tenantsPhase === 'loading' ? (
        <SurfaceState
          kind="loading"
          title="Đang tải danh sách tenant…"
          detail="Discovery qua /me/tenants — chưa chọn ngữ cảnh sự kiện."
          testId="admin-tenants-loading"
        />
      ) : tenantsLoadError ? (
        <SurfaceState
          kind="error"
          title="Không tải được tenant"
          detail={`Selector /me/tenants: ${tenantsLoadError}. Có thể dùng ô Tenant ID tạm khi BE chưa sẵn sàng.`}
          testId="admin-tenants-error"
        />
      ) : tenantChoices.length === 0 ? (
        <SurfaceState
          kind="empty"
          title="Chưa có tenant trong tài khoản"
          detail="Đăng nhập đúng tài khoản có membership, hoặc nhận invite thành viên trước khi quản trị sự kiện."
          testId="admin-tenants-empty"
        />
      ) : (
        <p className="intro">
          Chọn tổ chức bằng tên/slug. UUID nội bộ nằm trong «Chi tiết kỹ thuật».
        </p>
      )}
      <label>
        Tổ chức
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
          <option value="">— chọn tổ chức —</option>
          {tenantChoices.map((t) => (
            <option key={t.tenantId} value={t.tenantId}>
              {t.name} · {t.slug} ({t.status}/{t.role})
            </option>
          ))}
        </select>
      </label>
      <details className="admin-tech-details" data-testid="admin-tech-details">
        <summary>Chi tiết kỹ thuật (ID)</summary>
        <div className="redeem-fields">
          <label>
            Tenant ID
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
      </details>
      {tenantSuspended ? (
        <aside className="notice" role="status" data-testid="suspend-banner">
          <strong>Tenant SUSPENDED</strong>
          <p>
            Admin mutations bị chặn. Vé đã phát / Gate / recovery vẫn dùng được.
            Backend vẫn enforce — UI chỉ cảnh báo.
          </p>
        </aside>
      ) : null}
      <div className="admin" data-testid="admin-shell">
        <aside className="admin-sidebar" aria-label="Điều hướng quản trị">
          <p className="eyebrow admin-sidebar__eyebrow">Không gian</p>
          <nav
            className="admin-job-nav"
            aria-label="Việc quản trị"
            data-testid="admin-job-nav"
          >
            {ADMIN_JOBS.map((job) => (
              <button
                key={job.id}
                type="button"
                className="admin-job-nav__btn"
                data-testid={`admin-job-${job.id}`}
                aria-current={activeJob === job.id ? 'true' : 'false'}
                onClick={() => setActiveJob(job.id)}
              >
                {job.label}
              </button>
            ))}
          </nav>
        </aside>
        <div className="admin-main">
          <AdminStatsBar
            eventList={listView}
            readinessItems={readinessItems}
            tenantLabel={
              orgTitle?.trim() ||
              (tenantChoices.length > 0
                ? `${tenantChoices.length} tổ chức`
                : 'Chưa chọn')
            }
            hasEventContext={Boolean(eventId.trim() || currentEvent)}
          />
          <div className="admin-main__grid">
            <div className="admin-job-panels">
          <section
            className="admin-section admin-job-panel"
            data-job="setup"
            hidden={activeJob !== 'setup'}
            aria-labelledby="create-event-heading"
          >
            <h2 id="create-event-heading">Chuẩn bị · sự kiện</h2>
            <p>
              Tạo hoặc liệt kê sự kiện trong tổ chức. Kết quả chưa rõ (timeout/5xx)
              không coi là đã tạo.
            </p>
            <details className="admin-tech-details">
              <summary>Chi tiết kỹ thuật · tạo sự kiện</summary>
              <p className="muted">
                POST create qua BFF kèm Idempotency-Key và CSRF. Shape sai → chưa
                biết, không coi là đã tạo.
              </p>
            </details>
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
            <label>
              Visibility
              <select
                name="eventVisibility"
                value={metaVisibility}
                onChange={(e) =>
                  setMetaVisibility(
                    e.target.value === 'PUBLIC' ? 'PUBLIC' : 'UNLISTED',
                  )
                }
              >
                <option value="UNLISTED">UNLISTED</option>
                <option value="PUBLIC">PUBLIC</option>
              </select>
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
              <button
                type="button"
                disabled={busy || !eventId.trim()}
                onClick={() => void loadEventDetail()}
              >
                Tải metadata event
              </button>
            </div>
            {listView?.kind === 'list' ? (
              listView.items.length === 0 ? (
                <SurfaceState
                  kind="empty"
                  title="Chưa có event trong tenant"
                  detail="Tạo event mới phía trên, hoặc kiểm tra tenant đã chọn đúng chưa."
                  testId="admin-events-empty"
                />
              ) : (
                <div className="tablewrap" data-testid="event-list">
                  <table className="admin-table">
                    <caption className="visually-hidden">
                      Danh sách sự kiện trong tổ chức
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Sự kiện</th>
                        <th scope="col">Trạng thái</th>
                        <th scope="col">Phiên bản</th>
                        <th scope="col">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listView.items.map((item) => (
                        <tr key={item.eventId}>
                          <td data-label="Sự kiện">
                            <span className="admin-table__primary">
                              {item.name}
                            </span>
                            <span className="admin-table__secondary muted">
                              {item.slug}
                            </span>
                          </td>
                          <td data-label="Trạng thái">
                            {item.contentStatus}/{item.businessStatus}
                          </td>
                          <td data-label="Phiên bản">rev {item.revision}</td>
                          <td data-label="Thao tác">
                            <button
                              type="button"
                              className="admin-table__action"
                              onClick={() => void selectEventContext(item.eventId)}
                            >
                              Chọn
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : null}
          </section>
          <EventLifecycleSection
            activeJob={activeJob}
            busy={busy}
            currentEvent={currentEvent}
            eventId={eventId}
            metaStartsAt={metaStartsAt}
            setMetaStartsAt={setMetaStartsAt}
            metaEndsAt={metaEndsAt}
            setMetaEndsAt={setMetaEndsAt}
            metaVenueName={metaVenueName}
            setMetaVenueName={setMetaVenueName}
            metaVenueAddress={metaVenueAddress}
            setMetaVenueAddress={setMetaVenueAddress}
            metaContactEmail={metaContactEmail}
            setMetaContactEmail={setMetaContactEmail}
            metaRedeemOpen={metaRedeemOpen}
            setMetaRedeemOpen={setMetaRedeemOpen}
            metaRedeemClose={metaRedeemClose}
            setMetaRedeemClose={setMetaRedeemClose}
            metaCheckInOpen={metaCheckInOpen}
            setMetaCheckInOpen={setMetaCheckInOpen}
            metaCheckInClose={metaCheckInClose}
            setMetaCheckInClose={setMetaCheckInClose}
            metaMaxTickets={metaMaxTickets}
            setMetaMaxTickets={setMetaMaxTickets}
            confirmIssuedImpact={confirmIssuedImpact}
            setConfirmIssuedImpact={setConfirmIssuedImpact}
            notifyAttendees={notifyAttendees}
            setNotifyAttendees={setNotifyAttendees}
            cloneSlug={cloneSlug}
            setCloneSlug={setCloneSlug}
            cloneName={cloneName}
            setCloneName={setCloneName}
            copyConfig={copyConfig}
            setCopyConfig={setCopyConfig}
            cancelReason={cancelReason}
            setCancelReason={setCancelReason}
            impactView={impactView}
            onPreviewImpact={() => void lifecycleApi.previewImpact()}
            onSaveMetadata={() => void lifecycleApi.saveEventMetadata()}
            onClone={() => void lifecycleApi.cloneCurrentEvent()}
            onArchive={() => void lifecycleApi.archiveCurrentEvent()}
            onCancel={() => void lifecycleApi.cancelCurrentEvent()}
          />
          <TicketSourceSection
            activeJob={activeJob}
            busy={busy}
            ticketTypeLabelInput={ticketSourceApi.ticketTypeLabelInput}
            setTicketTypeLabelInput={ticketSourceApi.setTicketTypeLabelInput}
            ticketTypeId={ticketTypeId}
            setTicketTypeId={setTicketTypeId}
            sourceName={ticketSourceApi.sourceName}
            setSourceName={ticketSourceApi.setSourceName}
            approvalMode={ticketSourceApi.approvalMode}
            setApprovalMode={ticketSourceApi.setApprovalMode}
            sourceId={sourceId}
            setSourceId={setSourceId}
            onCreateTicketType={() => void ticketSourceApi.createTicketType()}
            onCreateSource={() => void ticketSourceApi.createSource()}
          />
          <div
            className="admin-job-panel"
            data-job="setup"
            hidden={activeJob !== 'setup'}
            data-testid="admin-setup-config"
          >
            <ConfigBrandPanel
              editor={configEditor}
              onEditorChange={setConfigEditor}
              scope={scope()}
              busy={busy}
              expectedVersion={expectedVersion}
              onExpectedVersion={setExpectedVersion}
              eventRevision={currentEvent?.revision ?? null}
              publishReady={publishReady}
              onSavedVersion={(version) => {
                setExpectedVersion(String(version));
                setDecision({ kind: 'saved', version });
                bumpNotice();
              }}
              onPublished={(version) => {
                setConfigEditor((prev) => lockPublishedConfig(prev));
                setExpectedVersion(String(version));
                setDecision({ kind: 'published', version });
                bumpNotice();
              }}
              onNotice={(message, kind) => {
                setConfigNotice(message);
                if (kind === 'error') {
                  setDecision({
                    kind: 'rejected',
                    code: 'CONFIG_EDITOR',
                    message,
                  });
                } else if (kind === 'unknown') {
                  setDecision({ kind: 'unknown', message });
                }
                bumpNotice();
              }}
            />
            {configNotice ? (
              <p role="status" data-testid="config-panel-notice">
                {configNotice}
              </p>
            ) : null}
            <p className="intro" data-testid="admin-publish-gate" role="status">
              {publishReady
                ? 'Checklist đủ — nút xuất bản hiện trong phần nội dung & brand. Backend vẫn enforce; chưa rõ ≠ đã xuất bản.'
                : readinessSummary(readinessItems)}
            </p>
          </div>
          <div
            className="admin-job-panel"
            data-job="guests"
            hidden={activeJob !== 'guests'}
            data-testid="admin-guests-panel"
          >
            <ImportPanel
              tenantId={tenantId}
              eventId={eventId}
              sourceId={sourceId}
              ticketTypeId={ticketTypeId}
              busy={busy}
              setBusy={setBusy}
              onNotice={(message) => {
                bumpNotice();
                setDecision({
                  kind: 'rejected',
                  code: 'IMPORT_NOTICE',
                  message,
                });
              }}
            />
            <section
              className="admin-section"
              aria-labelledby="guests-codes-heading"
            >
              <h2 id="guests-codes-heading" tabIndex={-1}>
                Khách &amp; mã · nhập và duyệt
              </h2>
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
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void loadQuota()}
                >
                  Đọc quota
                </button>
              </div>
              <RedemptionApprovalSection
                busy={busy}
                requestId={redemptionApi.requestId}
                setRequestId={redemptionApi.setRequestId}
                denyReason={redemptionApi.denyReason}
                setDenyReason={redemptionApi.setDenyReason}
                onApprove={() => void redemptionApi.decideRedemption('approve')}
                onDeny={() => void redemptionApi.decideRedemption('deny')}
              />
            </section>
            <NotificationsPanel
              tenantId={tenantId}
              eventId={eventId}
              eventRevision={currentEvent?.revision ?? null}
              busy={busy}
              onBusy={setBusy}
            />
          </div>
          <EventReportSection
            activeJob={activeJob}
            busy={busy}
            report={report}
            onLoadReport={() => void eventReportApi.loadReport()}
            onGoToSection={goToAdminSection}
          />
          <div
            className="admin-job-panel"
            data-job="support"
            hidden={activeJob !== 'support'}
            data-testid="admin-support-panel"
          >
            <TenantStaffPanel tenantId={tenantId} />
            <CsSection
              busy={busy}
              csQuery={csApi.csQuery}
              setCsQuery={csApi.setCsQuery}
              csTicketId={csApi.csTicketId}
              setCsTicketId={csApi.setCsTicketId}
              csCursor={csApi.csCursor}
              csView={csView}
              resendCooldownActive={csApi.resendCooldownActive}
              resendCooldownRemainingSec={csApi.resendCooldownRemainingSec}
              onSearch={() => void csApi.csSearch()}
              onSearchNext={() => void csApi.csSearch()}
              onResetCursor={csApi.resetCsCursor}
              onDetail={() => void csApi.csDetail()}
              onResend={() => void csApi.csResend()}
            />
            <ExportSection
              busy={busy}
              exportId={exportApi.exportId}
              setExportId={exportApi.setExportId}
              onCreateExport={() => void exportApi.createExport()}
              onLoadStatus={() => void exportApi.loadExportStatus()}
              onDownload={() => void exportApi.downloadExport()}
            />
          </div>
            </div>
            <AdminReadinessAside items={readinessItems} />
          </div>
        </div>
      </div>
      {(() => {
        const notice = createView
          ? {
              error: createView.kind === 'rejected',
              text: createEventLabel(createView),
            }
          : lifecycleView
            ? {
                error: lifecycleView.kind === 'rejected',
                text: eventMutationLabel(lifecycleView),
              }
            : impactView
              ? {
                  error: impactView.kind === 'rejected',
                  text: eventImpactLabel(impactView),
                }
              : detailView
                ? {
                    error: detailView.kind === 'rejected',
                    text: eventDetailLabel(detailView),
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
