import type {
  InvitationSummary,
  StaffPendingRedemptionItem,
} from '@ticket/contracts';
import { interpretInvitationList } from '../ops/invitation';
import { interpretCsList, type CsTicketSummary } from '../ops/cs';
import type { GuestListKind } from './guest-list-query';

export type GuestListRow = {
  key: string;
  state: string;
  email: string | null;
  sourceId: string;
  ticketTypeId: string;
  at: string;
  checkInAt?: string | null;
  notification?: CsTicketSummary['notification'];
  timeline: { at: string; kind: string; summary: string }[];
};
export type GuestListPage = { rows: GuestListRow[]; nextCursor: string | null };

function validPage(
  value: unknown,
): value is { items: unknown[]; nextCursor: string | null } {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  return (
    Array.isArray(body.items) &&
    (body.nextCursor === null || typeof body.nextCursor === 'string')
  );
}

function requestRow(value: unknown): GuestListRow | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<StaffPendingRedemptionItem> &
    Record<string, unknown>;
  if (
    'email' in item ||
    'actorEmail' in item ||
    'phone' in item ||
    'token' in item
  )
    return null;
  if (
    typeof item.requestId !== 'string' ||
    item.status !== 'PENDING_REVIEW' ||
    typeof item.sourceId !== 'string' ||
    typeof item.ticketTypeId !== 'string' ||
    typeof item.submittedAt !== 'string' ||
    (item.actorEmailMasked !== null &&
      typeof item.actorEmailMasked !== 'string')
  )
    return null;
  return {
    key: item.requestId,
    state: item.status,
    email: item.actorEmailMasked,
    sourceId: item.sourceId,
    ticketTypeId: item.ticketTypeId,
    at: item.submittedAt,
    timeline: [
      {
        at: item.submittedAt,
        kind: 'request',
        summary: 'guests.timeline.redemptionSubmitted',
      },
    ],
  };
}

export function readGuestListPage(
  kind: GuestListKind,
  status: number,
  body: unknown,
  networkError: boolean,
): GuestListPage | null {
  if (networkError || status !== 200) return null;
  if (kind === 'invitations') {
    const view = interpretInvitationList(status, body, false);
    if (view.kind !== 'list') return null;
    return {
      rows: view.items.map((item: InvitationSummary) => ({
        key: item.invitationId,
        state: item.state,
        email: item.invitedEmailMasked,
        sourceId: item.sourceId,
        ticketTypeId: item.ticketTypeId,
        at: item.expiresAt,
        timeline: [],
      })),
      nextCursor: view.nextCursor,
    };
  }
  if (kind === 'tickets') {
    const view = interpretCsList(status, body, false);
    if (view.kind !== 'list') return null;
    return {
      rows: view.items.map((item) => ({
        key: item.ticketId,
        state: item.state,
        email: item.ownerEmailMasked,
        sourceId: item.sourceId,
        ticketTypeId: item.ticketTypeId,
        at: item.createdAt,
        checkInAt: item.lastCheckInAt,
        notification: item.notification,
        timeline: [],
      })),
      nextCursor: view.cursor,
    };
  }
  if (!validPage(body)) return null;
  const rows = body.items.map(requestRow);
  if (rows.some((row) => row === null)) return null;
  return { rows: rows as GuestListRow[], nextCursor: body.nextCursor };
}
