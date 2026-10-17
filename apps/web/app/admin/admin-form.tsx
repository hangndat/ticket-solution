'use client';

import { useEffect, useState } from 'react';
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
  buildCancelEventBody,
  buildCloneEventBody,
  buildImpactPreviewRequest,
  buildPatchEventBody,
  eventDetailLabel,
  eventImpactLabel,
  eventMutationLabel,
  interpretEventDetail,
  interpretEventImpactPreview,
  interpretEventMutation,
  patchMayAffectIssuedTickets,
  type EventDetailView,
  type EventImpactView,
  type EventMutationView,
} from '../../src/admin/event-lifecycle';
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
  initialConfigEditor,
  lockPublishedConfig,
  type ConfigEditor,
} from '../../src/admin/config-editor';
import { fetchJson } from '../../src/redeem/fetch-json';
import { REQUEST_TIMEOUT_MS } from '../../src/redeem/poll-operation';
import { ConfigBrandPanel } from './config-brand-panel';

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
  const [configEditor, setConfigEditor] = useState<ConfigEditor>(() =>
    initialConfigEditor(),
  );
  const [expectedVersion, setExpectedVersion] = useState('');
  const [configNotice, setConfigNotice] = useState<string | null>(null);
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
  const [sourceId, setSourceId] = useState('');
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
  const [patchAttempt, setPatchAttempt] = useState<UnclearAttempt | null>(null);
  const [cloneAttempt, setCloneAttempt] = useState<UnclearAttempt | null>(null);
  const [cancelAttempt, setCancelAttempt] = useState<UnclearAttempt | null>(
    null,
  );
  const [archiveAttempt, setArchiveAttempt] = useState<UnclearAttempt | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [noticeSeq, setNoticeSeq] = useState(0);
  const [tenantChoices, setTenantChoices] = useState<MeTenantItem[]>([]);
  const [tenantsLoadError, setTenantsLoadError] = useState<string | null>(null);
  const [decision, setDecision] = useState<AdminDecision | null>(null);
  const [createView, setCreateView] = useState<CreateEventView | null>(null);
  const [listView, setListView] = useState<EventListView | null>(null);
  const [detailView, setDetailView] = useState<EventDetailView | null>(null);
  const [lifecycleView, setLifecycleView] = useState<EventMutationView | null>(
    null,
  );
  const [impactView, setImpactView] = useState<EventImpactView | null>(null);
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
  const [ticketTypeView, setTicketTypeView] = useState<TicketTypeView | null>(
    null,
  );
  const [sourceView, setSourceView] = useState<SourceView | null>(null);
  const [csView, setCsView] = useState<CsView | null>(null);
  const [exportView, setExportView] = useState<ExportView | null>(null);
  const [report, setReport] = useState<EventReportView | null>(null);
  const currentEvent: EventDetail | null =
    detailView?.kind === 'detail' ? detailView.event : null;
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
    setLifecycleView(null);
    setImpactView(null);
    setTicketTypeView(null);
    setSourceView(null);
    setCsView(null);
    setExportView(null);
  }

  function applyEventToEditor(event: EventDetail) {
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
      setConfigEditor((prev) => lockPublishedConfig(prev));
      setExpectedVersion(String(next.version));
    }
    bumpNotice();
    setDecision(next);
    setBusy(false);
  }

  function scope() {
    return { tenantId: tenantId.trim(), eventId: eventId.trim() };
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
      visibility: metaVisibility,
    });
    const idempotencyKey = reuseUnclearKey(createAttempt, fingerprint);
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
    setCreateAttempt({
      key: idempotencyKey,
      fingerprint,
      unclear: next.kind === 'unknown',
    });
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

  async function previewImpact() {
    if (!currentEvent) return;
    setBusy(true);
    setDecision(null);
    setImpactView(null);
    setLifecycleView(null);
    const body = buildImpactPreviewRequest({
      expectedRevision: currentEvent.revision,
      startsAt: metaStartsAt.trim() || null,
      endsAt: metaEndsAt.trim() || null,
      venueName: metaVenueName.trim() || undefined,
      venueAddress: metaVenueAddress.trim() || undefined,
    });
    const result = await adminMutate(
      `/api/bff/admin/events/${encodeURIComponent(eventId.trim())}/impact-preview`,
      { tenantId: tenantId.trim(), ...body },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretEventImpactPreview(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    bumpNotice();
    setImpactView(next);
    setBusy(false);
  }

  async function saveEventMetadata() {
    if (!currentEvent) return;
    const mayAffect = patchMayAffectIssuedTickets(currentEvent, {
      startsAt: metaStartsAt.trim() || null,
      venueName: metaVenueName.trim() || undefined,
      venueAddress: metaVenueAddress.trim() || undefined,
    });
    if (
      mayAffect &&
      impactView?.kind === 'preview' &&
      impactView.preview.requiresConfirm &&
      !confirmIssuedImpact
    ) {
      setLifecycleView({
        kind: 'rejected',
        code: 'IMPACT_CONFIRM_REQUIRED',
        message:
          'Đổi giờ/địa điểm ảnh hưởng vé đã cấp — chạy preview và tick confirmIssuedImpact.',
      });
      bumpNotice();
      return;
    }
    const patch = buildPatchEventBody({
      expectedRevision: currentEvent.revision,
      name: eventName.trim() || undefined,
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
      confirmIssuedImpact: confirmIssuedImpact || undefined,
      notifyAttendees: mayAffect ? notifyAttendees : undefined,
    });
    const fingerprint = JSON.stringify({
      tenantId: tenantId.trim(),
      eventId: eventId.trim(),
      patch,
    });
    const idempotencyKey = reuseUnclearKey(patchAttempt, fingerprint);
    setBusy(true);
    setDecision(null);
    setCreateView(null);
    setListView(null);
    const result = await adminMutate(
      `/api/bff/admin/events/${encodeURIComponent(eventId.trim())}`,
      { tenantId: tenantId.trim(), idempotencyKey, ...patch },
      REQUEST_TIMEOUT_MS,
      'PATCH',
    );
    const next = interpretEventMutation(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setPatchAttempt({
      key: idempotencyKey,
      fingerprint,
      unclear: next.kind === 'unknown',
    });
    if (next.kind === 'ok') {
      applyEventToEditor(next.event);
      setDetailView({
        kind: 'detail',
        event: next.event,
        replayed: next.replayed,
      });
      setConfirmIssuedImpact(false);
    }
    bumpNotice();
    setLifecycleView(next);
    setBusy(false);
  }

  async function cloneCurrentEvent() {
    const body = buildCloneEventBody({
      slug: cloneSlug.trim(),
      name: cloneName.trim(),
      copyConfig,
    });
    const fingerprint = JSON.stringify({
      tenantId: tenantId.trim(),
      eventId: eventId.trim(),
      ...body,
    });
    const idempotencyKey = reuseUnclearKey(cloneAttempt, fingerprint);
    setBusy(true);
    setDecision(null);
    setCreateView(null);
    setListView(null);
    const result = await adminMutate(
      `/api/bff/admin/events/${encodeURIComponent(eventId.trim())}/clone`,
      { tenantId: tenantId.trim(), idempotencyKey, ...body },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretEventMutation(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setCloneAttempt({
      key: idempotencyKey,
      fingerprint,
      unclear: next.kind === 'unknown',
    });
    if (next.kind === 'ok') {
      applyEventToEditor(next.event);
      setDetailView({
        kind: 'detail',
        event: next.event,
        replayed: next.replayed,
      });
    }
    bumpNotice();
    setLifecycleView(next);
    setBusy(false);
  }

  async function archiveCurrentEvent() {
    if (!currentEvent) return;
    const fingerprint = JSON.stringify({
      tenantId: tenantId.trim(),
      eventId: eventId.trim(),
      expectedRevision: currentEvent.revision,
      op: 'archive',
    });
    const idempotencyKey = reuseUnclearKey(archiveAttempt, fingerprint);
    setBusy(true);
    setDecision(null);
    const result = await adminMutate(
      `/api/bff/admin/events/${encodeURIComponent(eventId.trim())}/archive`,
      {
        tenantId: tenantId.trim(),
        idempotencyKey,
        expectedRevision: currentEvent.revision,
      },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretEventMutation(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setArchiveAttempt({
      key: idempotencyKey,
      fingerprint,
      unclear: next.kind === 'unknown',
    });
    if (next.kind === 'ok') {
      applyEventToEditor(next.event);
      setDetailView({
        kind: 'detail',
        event: next.event,
        replayed: next.replayed,
      });
    }
    bumpNotice();
    setLifecycleView(next);
    setBusy(false);
  }

  async function cancelCurrentEvent() {
    if (!currentEvent) return;
    const body = buildCancelEventBody({
      expectedRevision: currentEvent.revision,
      reason: cancelReason,
      notifyAttendees,
    });
    const fingerprint = JSON.stringify({
      tenantId: tenantId.trim(),
      eventId: eventId.trim(),
      ...body,
    });
    const idempotencyKey = reuseUnclearKey(cancelAttempt, fingerprint);
    setBusy(true);
    setDecision(null);
    const result = await adminMutate(
      `/api/bff/admin/events/${encodeURIComponent(eventId.trim())}/cancel`,
      { tenantId: tenantId.trim(), idempotencyKey, ...body },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretEventMutation(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setCancelAttempt({
      key: idempotencyKey,
      fingerprint,
      unclear: next.kind === 'unknown',
    });
    if (next.kind === 'ok') {
      applyEventToEditor(next.event);
      setDetailView({
        kind: 'detail',
        event: next.event,
        replayed: next.replayed,
      });
    }
    bumpNotice();
    setLifecycleView(next);
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
    if (next.kind === 'created') setSourceId(next.sourceId);
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
          Context hiện tại: tenant + event đã chọn. POST create kèm
          Idempotency-Key và CSRF. Shape sai → chưa biết, không coi là đã tạo.
        </p>
        <p data-testid="current-event-context" className="intro">
          Context: tenant={tenantId.trim() || '—'} · event=
          {eventId.trim() || '—'}
          {currentEvent
            ? ` · ${currentEvent.contentStatus}/${currentEvent.businessStatus} · rev ${currentEvent.revision}`
            : ''}
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
          <ul data-testid="event-list">
            {listView.items.map((item) => (
              <li key={item.eventId}>
                <button
                  type="button"
                  onClick={() => void selectEventContext(item.eventId)}
                >
                  {item.slug} · {item.name} ({item.contentStatus}/
                  {item.businessStatus} · rev {item.revision})
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section aria-labelledby="event-lifecycle-heading">
        <h2 id="event-lifecycle-heading">Metadata &amp; lifecycle (C-E)</h2>
        <p>
          PATCH dùng expectedRevision; đổi startsAt/venue sau khi đã có vé cần
          impact preview + confirmIssuedImpact. Clone chỉ DRAFT allowlist —
          không sao staff/mã/vé. Cancel/archive tách business/content status.
        </p>
        <label>
          startsAt (UTC ISO)
          <input
            name="metaStartsAt"
            value={metaStartsAt}
            onChange={(e) => setMetaStartsAt(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="2026-11-01T10:00:00.000Z"
          />
        </label>
        <label>
          endsAt (UTC ISO)
          <input
            name="metaEndsAt"
            value={metaEndsAt}
            onChange={(e) => setMetaEndsAt(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Venue name
          <input
            name="metaVenueName"
            value={metaVenueName}
            onChange={(e) => setMetaVenueName(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Venue address
          <input
            name="metaVenueAddress"
            value={metaVenueAddress}
            onChange={(e) => setMetaVenueAddress(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Contact email
          <input
            name="metaContactEmail"
            value={metaContactEmail}
            onChange={(e) => setMetaContactEmail(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Redemption opensAt
          <input
            name="metaRedeemOpen"
            value={metaRedeemOpen}
            onChange={(e) => setMetaRedeemOpen(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Redemption closesAt
          <input
            name="metaRedeemClose"
            value={metaRedeemClose}
            onChange={(e) => setMetaRedeemClose(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Check-in opensAt
          <input
            name="metaCheckInOpen"
            value={metaCheckInOpen}
            onChange={(e) => setMetaCheckInOpen(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Check-in closesAt
          <input
            name="metaCheckInClose"
            value={metaCheckInClose}
            onChange={(e) => setMetaCheckInClose(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          maxTicketsPerAttendee (trống = unlimited)
          <input
            name="metaMaxTickets"
            value={metaMaxTickets}
            onChange={(e) => setMetaMaxTickets(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={confirmIssuedImpact}
            onChange={(e) => setConfirmIssuedImpact(e.target.checked)}
          />{' '}
          confirmIssuedImpact (bắt buộc khi impact requiresConfirm)
        </label>
        <label>
          <input
            type="checkbox"
            checked={notifyAttendees}
            onChange={(e) => setNotifyAttendees(e.target.checked)}
          />{' '}
          notifyAttendees
        </label>
        <div className="auth-buttons">
          <button
            type="button"
            disabled={busy || !currentEvent}
            onClick={() => void previewImpact()}
          >
            Preview impact
          </button>
          <button
            type="button"
            disabled={busy || !currentEvent}
            onClick={() => void saveEventMetadata()}
          >
            Lưu metadata (PATCH)
          </button>
        </div>
        {impactView?.kind === 'preview' ? (
          <aside
            className="notice"
            role="status"
            data-testid="event-impact-preview"
          >
            <p>{eventImpactLabel(impactView)}</p>
            <ul>
              {impactView.preview.diff.map((d) => (
                <li key={`${d.field}-${d.from}-${d.to}`}>
                  {d.field}: {d.from ?? '∅'} → {d.to ?? '∅'}
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
        <h3>Clone DRAFT</h3>
        <label>
          Clone slug
          <input
            name="cloneSlug"
            value={cloneSlug}
            onChange={(e) => setCloneSlug(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Clone name
          <input
            name="cloneName"
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={copyConfig}
            onChange={(e) => setCopyConfig(e.target.checked)}
          />{' '}
          copyConfig (allowlist cấu hình; không inventory/staff)
        </label>
        <div className="auth-buttons">
          <button
            type="button"
            disabled={busy || !eventId.trim()}
            onClick={() => void cloneCurrentEvent()}
          >
            Clone event
          </button>
        </div>
        <h3>Archive / Cancel</h3>
        <label>
          Cancel reason
          <input
            name="cancelReason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Lý do hủy (1–500)"
          />
        </label>
        <div className="auth-buttons">
          <button
            type="button"
            disabled={busy || !currentEvent}
            onClick={() => void archiveCurrentEvent()}
          >
            Archive (content)
          </button>
          <button
            type="button"
            disabled={busy || !currentEvent || cancelReason.trim().length < 1}
            onClick={() => void cancelCurrentEvent()}
          >
            Cancel (business)
          </button>
        </div>
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
        <label>
          Source ID
          <input
            name="sourceId"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </label>
      </section>
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
      <ConfigBrandPanel
        editor={configEditor}
        onEditorChange={setConfigEditor}
        scope={scope()}
        busy={busy}
        expectedVersion={expectedVersion}
        onExpectedVersion={setExpectedVersion}
        eventRevision={currentEvent?.revision ?? null}
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
