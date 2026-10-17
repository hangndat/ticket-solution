import type { SessionEpoch } from '../identity/session-boundary.ts';
import type { NotificationKind } from './notification-contract.ts';

/**
 * Push tap login-return intent (C-N).
 * Held in memory only — cleared on logout / account switch / successful route.
 * Never logs opaque ticket/event refs in analytics paths (callers use redact).
 */

export type NotificationTapIntent = {
  responseId: string;
  kind: NotificationKind;
  payloadVersion: number;
  ticketId?: string;
  eventId?: string;
  tenantId?: string;
  tenantSlug?: string;
  eventSlug?: string;
  /** User who parked under a verified session; null = signed-out park. */
  parkedUserId: string | null;
  parkedGeneration: number | null;
  createdAt: number;
};

let activeIntent: NotificationTapIntent | null = null;
/** Last successfully consumed response id — multiple taps → one route. */
let lastConsumedResponseId: string | null = null;
/** In-flight resolve for the same response (warm re-delivery). */
let inflightResponseId: string | null = null;

export function peekNotificationTapIntent(): NotificationTapIntent | null {
  return activeIntent;
}

export function peekLastConsumedResponseId(): string | null {
  return lastConsumedResponseId;
}

export function clearNotificationTapIntent(): void {
  activeIntent = null;
  inflightResponseId = null;
}

/** Test helper — reset dedupe + queue between cases. */
export function __resetNotificationIntentForTests(): void {
  activeIntent = null;
  lastConsumedResponseId = null;
  inflightResponseId = null;
}

export function markResponseConsumed(responseId: string): void {
  lastConsumedResponseId = responseId;
  if (activeIntent?.responseId === responseId) {
    activeIntent = null;
  }
  if (inflightResponseId === responseId) {
    inflightResponseId = null;
  }
}

export function beginResponseResolve(responseId: string): boolean {
  if (lastConsumedResponseId === responseId) return false;
  if (inflightResponseId === responseId) return false;
  inflightResponseId = responseId;
  return true;
}

export function endResponseResolve(responseId: string): void {
  if (inflightResponseId === responseId) {
    inflightResponseId = null;
  }
}

export function wasResponseConsumed(responseId: string): boolean {
  return lastConsumedResponseId === responseId;
}

export function parkNotificationTapIntent(
  intent: Omit<NotificationTapIntent, 'createdAt'>,
): NotificationTapIntent {
  // Newer tap supersedes a prior parked intent (one pending route).
  const next: NotificationTapIntent = { ...intent, createdAt: Date.now() };
  activeIntent = next;
  return next;
}

export type NotificationIntentResume =
  | { ok: true; intent: NotificationTapIntent }
  | {
      ok: false;
      reason: 'none' | 'epoch-stale' | 'user-mismatch' | 'already-consumed';
    };

/**
 * Resume after login only when the current verified epoch still owns the
 * parked intent (or it was parked while signed out).
 */
export function resumeNotificationTapIntent(input: {
  epoch: SessionEpoch | null;
  isEpochCurrent: (epoch: SessionEpoch | null) => boolean;
}): NotificationIntentResume {
  const intent = activeIntent;
  if (!intent) return { ok: false, reason: 'none' };
  if (lastConsumedResponseId === intent.responseId) {
    clearNotificationTapIntent();
    return { ok: false, reason: 'already-consumed' };
  }

  if (intent.parkedUserId !== null) {
    if (!input.epoch || input.epoch.userId !== intent.parkedUserId) {
      clearNotificationTapIntent();
      return { ok: false, reason: 'user-mismatch' };
    }
    if (
      intent.parkedGeneration !== null &&
      intent.parkedGeneration !== input.epoch.generation
    ) {
      clearNotificationTapIntent();
      return { ok: false, reason: 'epoch-stale' };
    }
    if (!input.isEpochCurrent(input.epoch)) {
      clearNotificationTapIntent();
      return { ok: false, reason: 'epoch-stale' };
    }
    return { ok: true, intent };
  }

  if (!input.epoch || !input.isEpochCurrent(input.epoch)) {
    return { ok: false, reason: 'epoch-stale' };
  }
  return { ok: true, intent };
}

/** Drop intent when verified identity flips or logs out. */
export function dropNotificationTapIntentIfStale(input: {
  epoch: SessionEpoch | null;
  isEpochCurrent: (epoch: SessionEpoch | null) => boolean;
}): void {
  const intent = activeIntent;
  if (!intent) return;
  if (intent.parkedUserId === null) {
    // Signed-out park survives until resume or explicit clear.
    return;
  }
  if (!input.epoch || input.epoch.userId !== intent.parkedUserId) {
    clearNotificationTapIntent();
    return;
  }
  if (
    intent.parkedGeneration !== null &&
    intent.parkedGeneration !== input.epoch.generation
  ) {
    clearNotificationTapIntent();
  }
}

/** Redacted debug view — never includes full opaque ids in logs by default. */
export function redactNotificationTapIntent(
  intent: NotificationTapIntent | null,
): Record<string, unknown> | null {
  if (!intent) return null;
  return {
    kind: intent.kind,
    payloadVersion: intent.payloadVersion,
    hasTicketId: Boolean(intent.ticketId),
    hasEventId: Boolean(intent.eventId),
    hasTenantId: Boolean(intent.tenantId),
    tenantSlug: intent.tenantSlug ?? null,
    eventSlug: intent.eventSlug ?? null,
    parkedUserId: intent.parkedUserId,
    parkedGeneration: intent.parkedGeneration,
    responseIdLength: intent.responseId.length,
  };
}
