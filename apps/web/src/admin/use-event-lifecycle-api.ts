'use client';

import { useCallback, useState } from 'react';
import type { EventDetail, EventVisibility } from '@ticket/contracts';
import { adminMutate } from './client-fetch';
import {
  buildCancelEventBody,
  buildCloneEventBody,
  buildImpactPreviewRequest,
  buildPatchEventBody,
  interpretEventImpactPreview,
  interpretEventMutation,
  patchMayAffectIssuedTickets,
  type EventDetailView,
  type EventImpactView,
  type EventMutationView,
} from './event-lifecycle';
import { useIdempotentAction } from './use-idempotent-action';
import { REQUEST_TIMEOUT_MS } from '../redeem/poll-operation';

export type EventLifecycleMetaInput = {
  metaStartsAt: string;
  metaEndsAt: string;
  metaVenueName: string;
  metaVenueAddress: string;
  metaContactEmail: string;
  metaRedeemOpen: string;
  metaRedeemClose: string;
  metaCheckInOpen: string;
  metaCheckInClose: string;
  metaMaxTickets: string;
  metaVisibility: EventVisibility;
  eventName: string;
  eventTimezone: string;
};

type Params = {
  tenantId: string;
  eventId: string;
  currentEvent: EventDetail | null;
  meta: EventLifecycleMetaInput;
  confirmIssuedImpact: boolean;
  notifyAttendees: boolean;
  cloneSlug: string;
  cloneName: string;
  copyConfig: boolean;
  cancelReason: string;
  setConfirmIssuedImpact: (value: boolean) => void;
  applyEventToEditor: (event: EventDetail) => void;
  setDetailView: (view: EventDetailView | null) => void;
  onBusy: (busy: boolean) => void;
  onBumpNotice: () => void;
  onBeforeLifecycleMutate: () => void;
};

export function useEventLifecycleApi({
  tenantId,
  eventId,
  currentEvent,
  meta,
  confirmIssuedImpact,
  notifyAttendees,
  cloneSlug,
  cloneName,
  copyConfig,
  cancelReason,
  setConfirmIssuedImpact,
  applyEventToEditor,
  setDetailView,
  onBusy,
  onBumpNotice,
  onBeforeLifecycleMutate,
}: Params) {
  const patchIdempotency = useIdempotentAction();
  const cloneIdempotency = useIdempotentAction();
  const cancelIdempotency = useIdempotentAction();
  const archiveIdempotency = useIdempotentAction();

  const [lifecycleView, setLifecycleView] = useState<EventMutationView | null>(
    null,
  );
  const [impactView, setImpactView] = useState<EventImpactView | null>(null);

  const clearViews = useCallback(() => {
    setLifecycleView(null);
    setImpactView(null);
  }, []);

  const previewImpact = useCallback(async () => {
    if (!currentEvent) return;
    onBusy(true);
    onBeforeLifecycleMutate();
    setImpactView(null);
    setLifecycleView(null);
    const body = buildImpactPreviewRequest({
      expectedRevision: currentEvent.revision,
      startsAt: meta.metaStartsAt.trim() || null,
      endsAt: meta.metaEndsAt.trim() || null,
      venueName: meta.metaVenueName.trim() || undefined,
      venueAddress: meta.metaVenueAddress.trim() || undefined,
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
    onBumpNotice();
    setImpactView(next);
    onBusy(false);
  }, [
    currentEvent,
    eventId,
    meta,
    onBeforeLifecycleMutate,
    onBumpNotice,
    onBusy,
    tenantId,
  ]);

  const saveEventMetadata = useCallback(async () => {
    if (!currentEvent) return;
    const mayAffect = patchMayAffectIssuedTickets(currentEvent, {
      startsAt: meta.metaStartsAt.trim() || null,
      venueName: meta.metaVenueName.trim() || undefined,
      venueAddress: meta.metaVenueAddress.trim() || undefined,
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
      onBumpNotice();
      return;
    }
    const patch = buildPatchEventBody({
      expectedRevision: currentEvent.revision,
      name: meta.eventName.trim() || undefined,
      timezone: meta.eventTimezone.trim() || undefined,
      visibility: meta.metaVisibility,
      startsAt: meta.metaStartsAt.trim() || null,
      endsAt: meta.metaEndsAt.trim() || null,
      venueName: meta.metaVenueName.trim() || undefined,
      venueAddress: meta.metaVenueAddress.trim() || undefined,
      contactEmail: meta.metaContactEmail.trim() || undefined,
      redemptionOpensAt: meta.metaRedeemOpen.trim() || null,
      redemptionClosesAt: meta.metaRedeemClose.trim() || null,
      checkInOpensAt: meta.metaCheckInOpen.trim() || null,
      checkInClosesAt: meta.metaCheckInClose.trim() || null,
      maxTicketsPerAttendee:
        meta.metaMaxTickets.trim() === ''
          ? null
          : Number(meta.metaMaxTickets.trim()),
      confirmIssuedImpact: confirmIssuedImpact || undefined,
      notifyAttendees: mayAffect ? notifyAttendees : undefined,
    });
    const fingerprint = JSON.stringify({
      tenantId: tenantId.trim(),
      eventId: eventId.trim(),
      patch,
    });
    const idempotencyKey = patchIdempotency.keyFor(fingerprint);
    onBusy(true);
    onBeforeLifecycleMutate();
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
    patchIdempotency.remember(
      idempotencyKey,
      fingerprint,
      next.kind === 'unknown',
    );
    if (next.kind === 'ok') {
      applyEventToEditor(next.event);
      setDetailView({
        kind: 'detail',
        event: next.event,
        replayed: next.replayed,
      });
      setConfirmIssuedImpact(false);
    }
    onBumpNotice();
    setLifecycleView(next);
    onBusy(false);
  }, [
    applyEventToEditor,
    confirmIssuedImpact,
    currentEvent,
    eventId,
    impactView,
    meta,
    notifyAttendees,
    onBeforeLifecycleMutate,
    onBumpNotice,
    onBusy,
    patchIdempotency,
    setConfirmIssuedImpact,
    setDetailView,
    tenantId,
  ]);

  const cloneCurrentEvent = useCallback(async () => {
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
    const idempotencyKey = cloneIdempotency.keyFor(fingerprint);
    onBusy(true);
    onBeforeLifecycleMutate();
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
    cloneIdempotency.remember(
      idempotencyKey,
      fingerprint,
      next.kind === 'unknown',
    );
    if (next.kind === 'ok') {
      applyEventToEditor(next.event);
      setDetailView({
        kind: 'detail',
        event: next.event,
        replayed: next.replayed,
      });
    }
    onBumpNotice();
    setLifecycleView(next);
    onBusy(false);
  }, [
    applyEventToEditor,
    cloneIdempotency,
    cloneName,
    cloneSlug,
    copyConfig,
    eventId,
    onBeforeLifecycleMutate,
    onBumpNotice,
    onBusy,
    setDetailView,
    tenantId,
  ]);

  const archiveCurrentEvent = useCallback(async () => {
    if (!currentEvent) return;
    const fingerprint = JSON.stringify({
      tenantId: tenantId.trim(),
      eventId: eventId.trim(),
      expectedRevision: currentEvent.revision,
      op: 'archive',
    });
    const idempotencyKey = archiveIdempotency.keyFor(fingerprint);
    onBusy(true);
    onBeforeLifecycleMutate();
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
    archiveIdempotency.remember(
      idempotencyKey,
      fingerprint,
      next.kind === 'unknown',
    );
    if (next.kind === 'ok') {
      applyEventToEditor(next.event);
      setDetailView({
        kind: 'detail',
        event: next.event,
        replayed: next.replayed,
      });
    }
    onBumpNotice();
    setLifecycleView(next);
    onBusy(false);
  }, [
    applyEventToEditor,
    archiveIdempotency,
    currentEvent,
    eventId,
    onBeforeLifecycleMutate,
    onBumpNotice,
    onBusy,
    setDetailView,
    tenantId,
  ]);

  const cancelCurrentEvent = useCallback(async () => {
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
    const idempotencyKey = cancelIdempotency.keyFor(fingerprint);
    onBusy(true);
    onBeforeLifecycleMutate();
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
    cancelIdempotency.remember(
      idempotencyKey,
      fingerprint,
      next.kind === 'unknown',
    );
    if (next.kind === 'ok') {
      applyEventToEditor(next.event);
      setDetailView({
        kind: 'detail',
        event: next.event,
        replayed: next.replayed,
      });
    }
    onBumpNotice();
    setLifecycleView(next);
    onBusy(false);
  }, [
    applyEventToEditor,
    cancelIdempotency,
    cancelReason,
    currentEvent,
    eventId,
    notifyAttendees,
    onBeforeLifecycleMutate,
    onBumpNotice,
    onBusy,
    setDetailView,
    tenantId,
  ]);

  return {
    lifecycleView,
    impactView,
    clearViews,
    previewImpact,
    saveEventMetadata,
    cloneCurrentEvent,
    archiveCurrentEvent,
    cancelCurrentEvent,
  };
}
