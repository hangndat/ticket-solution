/**
 * C-I guest invitation admin — list + dispatch preview/commit.
 * Not platform membership invites. Quota estimate never reserves seats.
 */

import type {
  InvitationDispatchPreviewResponse,
  InvitationDispatchResponse,
  InvitationState,
  InvitationSummary,
} from '@ticket/contracts';
import {
  apiErrorFrom,
  asRecord,
  isNonEmptyString,
} from './contract-shape';
import type { AdminScope } from './scope';
import { eventPath } from './scope';

export const INVITATION_UNKNOWN =
  'Kết quả invitation chưa biết. Không coi là đã dispatch.';

export type InvitationView =
  | {
      kind: 'list';
      items: InvitationSummary[];
      nextCursor: string | null;
    }
  | { kind: 'dispatch_preview'; preview: InvitationDispatchPreviewResponse }
  | { kind: 'dispatch'; result: InvitationDispatchResponse }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

const STATES = new Set<InvitationState>([
  'PENDING',
  'DISPATCHED',
  'CLAIMED',
  'EXPIRED',
  'REVOKED',
]);

export function invitationsPath(
  scope: AdminScope,
  query?: { cursor?: string; limit?: number },
): string {
  const base = eventPath(scope, 'invitations');
  const params = new URLSearchParams();
  if (query?.cursor) params.set('cursor', query.cursor);
  if (query?.limit !== undefined) params.set('limit', String(query.limit));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function invitationDispatchPreviewPath(scope: AdminScope): string {
  return eventPath(scope, 'invitations/dispatch-preview');
}

export function invitationDispatchPath(scope: AdminScope): string {
  return eventPath(scope, 'invitations/dispatch');
}

function parseSummary(value: unknown): InvitationSummary | null {
  const body = asRecord(value);
  if (!body) return null;
  if (
    !isNonEmptyString(body.invitationId) ||
    !isNonEmptyString(body.eventId) ||
    !isNonEmptyString(body.sourceId) ||
    !isNonEmptyString(body.ticketTypeId) ||
    !isNonEmptyString(body.invitedEmailMasked) ||
    !isNonEmptyString(body.expiresAt)
  ) {
    return null;
  }
  if (typeof body.state !== 'string' || !STATES.has(body.state as InvitationState)) {
    return null;
  }
  // Fail closed: raw email / token never accepted in list projection.
  if ('invitedEmail' in body || 'token' in body || 'rawToken' in body) {
    return null;
  }
  return {
    invitationId: body.invitationId.trim(),
    eventId: body.eventId.trim(),
    sourceId: body.sourceId.trim(),
    ticketTypeId: body.ticketTypeId.trim(),
    invitedEmailMasked: body.invitedEmailMasked.trim(),
    state: body.state as InvitationState,
    expiresAt: body.expiresAt.trim(),
  };
}

export function interpretInvitationList(
  status: number,
  json: unknown,
  networkError: boolean,
): InvitationView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: INVITATION_UNKNOWN };
  }
  if (status === 200) {
    const body = asRecord(json);
    if (!body || !Array.isArray(body.items)) {
      return { kind: 'unknown', message: INVITATION_UNKNOWN };
    }
    const items: InvitationSummary[] = [];
    for (const row of body.items) {
      const parsed = parseSummary(row);
      if (!parsed) {
        return { kind: 'unknown', message: INVITATION_UNKNOWN };
      }
      items.push(parsed);
    }
    const nextCursor =
      body.nextCursor === null || body.nextCursor === undefined
        ? null
        : typeof body.nextCursor === 'string'
          ? body.nextCursor
          : null;
    if (body.nextCursor !== null && body.nextCursor !== undefined && nextCursor === null) {
      return { kind: 'unknown', message: INVITATION_UNKNOWN };
    }
    return { kind: 'list', items, nextCursor };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: INVITATION_UNKNOWN };
}

export function interpretDispatchPreview(
  status: number,
  json: unknown,
  networkError: boolean,
): InvitationView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: INVITATION_UNKNOWN };
  }
  if (status === 200) {
    const body = asRecord(json);
    if (
      !body ||
      typeof body.previewRevision !== 'number' ||
      typeof body.selectedCount !== 'number' ||
      typeof body.estimatedQuota !== 'number'
    ) {
      return { kind: 'unknown', message: INVITATION_UNKNOWN };
    }
    return {
      kind: 'dispatch_preview',
      preview: {
        previewRevision: body.previewRevision,
        selectedCount: body.selectedCount,
        estimatedQuota: body.estimatedQuota,
      },
    };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: INVITATION_UNKNOWN };
}

export function interpretDispatch(
  status: number,
  json: unknown,
  networkError: boolean,
): InvitationView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: INVITATION_UNKNOWN };
  }
  if (status === 200 || status === 201) {
    const body = asRecord(json);
    if (
      !body ||
      typeof body.dispatchedCount !== 'number' ||
      typeof body.previewRevision !== 'number' ||
      typeof body.replayed !== 'boolean'
    ) {
      return { kind: 'unknown', message: INVITATION_UNKNOWN };
    }
    return {
      kind: 'dispatch',
      result: {
        dispatchedCount: body.dispatchedCount,
        previewRevision: body.previewRevision,
        replayed: body.replayed,
      },
    };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: INVITATION_UNKNOWN };
}

export function invitationViewLabel(view: InvitationView): string {
  if (view.kind === 'list') {
    return `Invitations: ${view.items.length} mục${view.nextCursor ? ' · còn trang sau' : ''}. Email chỉ masked; không auto-account.`;
  }
  if (view.kind === 'dispatch_preview') {
    const p = view.preview;
    return `Dispatch preview rev ${p.previewRevision}: ${p.selectedCount} chọn · ước tính quota ${p.estimatedQuota} (không reserve).`;
  }
  if (view.kind === 'dispatch') {
    const r = view.result;
    return `Đã dispatch ${r.dispatchedCount} · rev ${r.previewRevision}${r.replayed ? ' · replay' : ''}. Claim-time issue — chưa cấp vé.`;
  }
  if (view.kind === 'rejected') {
    return `${view.code}: ${view.message}`;
  }
  return view.message;
}
