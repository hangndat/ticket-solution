/**
 * C-G / D7 — Offline Gate sync transport (frozen for Issue #105).
 *
 * Amends ADR-06 for controlled offline check-in replay (ADR-18).
 * Server remains source of truth; RLS + tenant deny-by-default unchanged.
 * Apply semantics land in Issue #106 — this module freezes shapes/codes only.
 */

import { OFFLINE_SYNC_COMMAND } from './commands';

export { OFFLINE_SYNC_COMMAND };

/** Max events accepted in one POST body. */
export const OFFLINE_SYNC_MAX_BATCH = 50 as const;

/**
 * Absolute skew between clientOccurredAt / clientClockAt and server DB clock.
 * Outside this window the item is REJECTED with CLOCK_SKEW_EXCEEDED (no apply).
 */
export const OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS = 300 as const;

/** Transport payload version for OfflineSyncEvent. */
export const OFFLINE_SYNC_PAYLOAD_VERSION = 1 as const;

export const OFFLINE_SYNC_ENDPOINTS = {
  sync: '/v1/gate/events/{eventId}/offline-sync',
} as const;

/** Offline event kinds allowed in D7. Undo/revoke stay online-only. */
export const OFFLINE_SYNC_EVENT_TYPES = ['CHECKIN_OFFLINE'] as const;
export type OfflineSyncEventType = (typeof OFFLINE_SYNC_EVENT_TYPES)[number];

/**
 * Stable API error / per-item conflict codes for offline sync.
 * Additive only — do not reuse for unrelated Gate online paths unless listed.
 */
export const OFFLINE_SYNC_ERROR_CODES = {
  /** Whole batch rejected: body exceeds OFFLINE_SYNC_MAX_BATCH. */
  BATCH_TOO_LARGE: 'OFFLINE_SYNC_BATCH_TOO_LARGE',
  /** Item |clientOccurredAt| or batch clientClockAt outside max skew. */
  CLOCK_SKEW_EXCEEDED: 'OFFLINE_SYNC_CLOCK_SKEW_EXCEEDED',
  /** Same clientEventId reused with a different canonical payload. */
  IDEMPOTENCY_CONFLICT: 'OFFLINE_SYNC_IDEMPOTENCY_CONFLICT',
  /** Ticket already USED; this offline event lost (later in replay order). */
  CONFLICT_LOST: 'OFFLINE_SYNC_CONFLICT_LOST',
  /** Ticket already checked in (online or earlier offline winner). */
  ALREADY_CHECKED_IN: 'ALREADY_CHECKED_IN',
  /** Unknown or unsupported event type. */
  EVENT_TYPE_UNSUPPORTED: 'OFFLINE_SYNC_EVENT_TYPE_UNSUPPORTED',
  /** payloadVersion !== OFFLINE_SYNC_PAYLOAD_VERSION. */
  PAYLOAD_VERSION_UNSUPPORTED: 'OFFLINE_SYNC_PAYLOAD_VERSION_UNSUPPORTED',
  /** Staff session missing/inactive for tenant+event. */
  SESSION_NOT_ACTIVE: 'SESSION_NOT_ACTIVE',
  /** Ticket not visible under tenant RLS / not found. */
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  /** Event cancelled or check-in window closed at apply time. */
  CHECKIN_WINDOW_CLOSED: 'CHECKIN_WINDOW_CLOSED',
  EVENT_CANCELLED: 'EVENT_CANCELLED',
  /** clientSeq must be >= 0 integer; device queue must not go backwards for same key. */
  REPLAY_ORDER_INVALID: 'OFFLINE_SYNC_REPLAY_ORDER_INVALID',
  /** Contract published; durable apply not wired yet (removed by #106). */
  NOT_IMPLEMENTED: 'OFFLINE_SYNC_NOT_IMPLEMENTED',
} as const;

export type OfflineSyncErrorCode =
  (typeof OFFLINE_SYNC_ERROR_CODES)[keyof typeof OFFLINE_SYNC_ERROR_CODES];

/**
 * One offline scan captured on-device while backend unreachable.
 *
 * Idempotency key: `clientEventId` (UUID) unique per tenant.
 * Replay key: (clientOccurredAt ASC, clientSeq ASC, clientEventId ASC).
 */
export interface OfflineSyncEvent {
  /** Client-generated UUID — primary idempotency key within tenant. */
  clientEventId: string;
  type: OfflineSyncEventType;
  /** Must equal path eventId; echoed for client-side queue integrity. */
  eventId: string;
  ticketId: string;
  /**
   * Device wall time when the scan was accepted locally (ISO-8601 UTC).
   * Used for clock-skew check and replay ordering — not trusted beyond skew.
   */
  clientOccurredAt: string;
  /**
   * Monotonic per (deviceId, staffSessionId) queue sequence starting at 0.
   * Tie-breaks equal clientOccurredAt; must not decrease for that device session.
   */
  clientSeq: number;
  payloadVersion: typeof OFFLINE_SYNC_PAYLOAD_VERSION;
}

/** POST /v1/gate/events/{eventId}/offline-sync body. */
export interface OfflineSyncRequestBody {
  tenantId: string;
  staffSessionId: string;
  /** Stable staff device id (SecureStore / web local); not a second auth factor. */
  deviceId: string;
  /**
   * Client wall clock when the HTTP batch was assembled (ISO-8601 UTC).
   * Compared to server clock for batch-level skew before per-event checks.
   */
  clientClockAt: string;
  events: OfflineSyncEvent[];
}

export type OfflineSyncItemStatus =
  | 'APPLIED'
  | 'DUPLICATE'
  | 'REJECTED'
  | 'CONFLICT';

/** Per-event outcome inside an accepted HTTP batch. */
export interface OfflineSyncItemResult {
  clientEventId: string;
  status: OfflineSyncItemStatus;
  /** Set when status is APPLIED or DUPLICATE (prior apply). */
  checkinId?: string;
  /** Stable code when status is REJECTED or CONFLICT. */
  code?: OfflineSyncErrorCode;
  /** Non-PII operator message; clients should key off `code`. */
  message?: string;
  /** When CONFLICT_LOST / ALREADY_CHECKED_IN — winning check-in if known. */
  winningCheckinId?: string;
  winningDeviceId?: string;
}

export interface OfflineSyncResponse {
  serverTime: string;
  maxClockSkewSeconds: typeof OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS;
  results: OfflineSyncItemResult[];
}

/** Whole-batch failure uses the shared ApiError envelope. */
export interface OfflineSyncBatchError {
  code: OfflineSyncErrorCode;
  message: string;
  requestId: string;
  operationId?: string;
  retryable: boolean;
}

/**
 * Canonical replay comparator for offline events (pure; shared by BE/tests).
 * Returns negative if `a` must apply before `b`.
 */
export function compareOfflineReplayOrder(
  a: Pick<OfflineSyncEvent, 'clientOccurredAt' | 'clientSeq' | 'clientEventId'>,
  b: Pick<OfflineSyncEvent, 'clientOccurredAt' | 'clientSeq' | 'clientEventId'>,
): number {
  if (a.clientOccurredAt < b.clientOccurredAt) return -1;
  if (a.clientOccurredAt > b.clientOccurredAt) return 1;
  if (a.clientSeq !== b.clientSeq) return a.clientSeq - b.clientSeq;
  if (a.clientEventId < b.clientEventId) return -1;
  if (a.clientEventId > b.clientEventId) return 1;
  return 0;
}

/**
 * Absolute skew in seconds between an ISO timestamp and server epoch ms.
 * Returns null when `iso` is not a finite date.
 */
export function offlineClockSkewSeconds(
  iso: string,
  serverEpochMs: number,
): number | null {
  const clientMs = Date.parse(iso);
  if (!Number.isFinite(clientMs)) return null;
  return Math.abs(clientMs - serverEpochMs) / 1000;
}

export function isWithinOfflineClockSkew(
  iso: string,
  serverEpochMs: number,
  maxSkewSeconds: number = OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS,
): boolean {
  const skew = offlineClockSkewSeconds(iso, serverEpochMs);
  if (skew === null) return false;
  return skew <= maxSkewSeconds;
}
