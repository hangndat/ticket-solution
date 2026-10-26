import { apiErrorCode, type PortalFetchResult } from './portal-fetch';

export type IntentScope = {
  actorId: string;
  tenantId: string;
  eventId?: string;
  command: string;
};

type Marker = { version: 1; key: string; createdAt: number };
type Pending = { marker: Marker; serialized: string; attempts: number };
export type IntentOutcome =
  | { kind: 'confirmed'; response: PortalFetchResult }
  | { kind: 'rejected'; response: PortalFetchResult }
  | { kind: 'unknown'; response?: PortalFetchResult }
  | { kind: 'blocked'; reason: 'recovery' | 'expired' | 'mismatch' | 'conflict' | 'storage' };

export function intentBlockMessageKey(reason: string | null) {
  switch (reason) {
    case 'mismatch': return 'intent.mismatch' as const;
    case 'expired': return 'intent.expired' as const;
    case 'conflict': return 'intent.conflict' as const;
    case 'recovery': return 'intent.recovery' as const;
    case 'storage': return 'intent.storage' as const;
    default: return 'intent.blocked' as const;
  }
}

// A conservative client stop, not a promise about backend retention.
export const MAX_INTENT_RETRY_AGE_MS = 5 * 60_000;
const MAX_ATTEMPTS = 2;

export function intentStorageKey(scope: IntentScope): string {
  return `portal:intent:v1:${encodeURIComponent(scope.actorId)}:${encodeURIComponent(scope.tenantId)}:${encodeURIComponent(scope.eventId ?? '')}:${encodeURIComponent(scope.command)}`;
}

/** One command/context per instance. Storage contains only a key and timestamp, never payload or PII. */
export class IntentMutation<T> {
  private pending: Pending | null = null;
  private flight: Promise<IntentOutcome> | null = null;
  private blocked: IntentOutcome | null = null;
  private readonly storageKey: string;

  constructor(
    scope: IntentScope,
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
    private readonly newKey: () => string = () => crypto.randomUUID(),
    private readonly now: () => number = () => Date.now(),
  ) {
    this.storageKey = intentStorageKey(scope);
    try {
      const raw = storage.getItem(this.storageKey);
      if (raw) {
        const value: unknown = JSON.parse(raw);
        if (
          value && typeof value === 'object' &&
          (value as Marker).version === 1 &&
          typeof (value as Marker).key === 'string' &&
          Number.isFinite((value as Marker).createdAt)
        ) {
          this.blocked = { kind: 'blocked', reason: 'recovery' };
        } else {
          this.blocked = { kind: 'blocked', reason: 'storage' };
        }
      }
    } catch {
      this.blocked = { kind: 'blocked', reason: 'storage' };
    }
  }

  get state(): 'idle' | 'in-flight' | 'unknown' | 'blocked' {
    if (this.flight) return 'in-flight';
    if (this.blocked) return 'blocked';
    return this.pending ? 'unknown' : 'idle';
  }

  get blockReason(): IntentOutcome | null {
    return this.blocked;
  }

  run(
    payload: T,
    send: (body: T & { idempotencyKey: string }) => Promise<PortalFetchResult>,
    confirmed: (response: PortalFetchResult) => boolean,
  ): Promise<IntentOutcome> {
    if (this.flight) return this.flight;
    if (this.blocked) return Promise.resolve(this.blocked);
    const serialized = JSON.stringify(payload);
    if (this.pending && this.pending.serialized !== serialized) {
      this.blocked = { kind: 'blocked', reason: 'mismatch' };
      return Promise.resolve(this.blocked);
    }
    if (this.pending && (this.now() - this.pending.marker.createdAt >= MAX_INTENT_RETRY_AGE_MS || this.pending.attempts >= MAX_ATTEMPTS)) {
      this.blocked = { kind: 'blocked', reason: 'expired' };
      return Promise.resolve(this.blocked);
    }
    if (!this.pending) {
      const marker: Marker = { version: 1, key: this.newKey(), createdAt: this.now() };
      try {
        this.storage.setItem(this.storageKey, JSON.stringify(marker));
      } catch {
        this.blocked = { kind: 'blocked', reason: 'storage' };
        return Promise.resolve(this.blocked);
      }
      this.pending = { marker, serialized, attempts: 0 };
    }
    const pending = this.pending;
    pending.attempts += 1;
    this.flight = (async (): Promise<IntentOutcome> => {
      let response: PortalFetchResult;
      try {
        response = await send({ ...JSON.parse(pending.serialized) as T, idempotencyKey: pending.marker.key });
      } catch {
        return { kind: 'unknown' };
      }
      if (apiErrorCode(response.json) === 'IDEMPOTENCY_CONFLICT') {
        this.blocked = { kind: 'blocked', reason: 'conflict' };
        return this.blocked;
      }
      if (response.networkError || response.timedOut || response.status === 0 || response.status >= 500 || (response.json && typeof response.json === 'object' && (response.json as { retryable?: unknown }).retryable === true)) {
        return { kind: 'unknown', response };
      }
      if (response.json && typeof response.json === 'object' && (response.json as { state?: unknown }).state === 'FAILED') {
        this.clear();
        return { kind: 'rejected', response };
      }
      if (response.status >= 200 && response.status < 300) {
        if (!confirmed(response)) return { kind: 'unknown', response };
        this.clear();
        return { kind: 'confirmed', response };
      }
      if (pending.attempts > 1) {
        this.blocked = { kind: 'blocked', reason: 'recovery' };
        return this.blocked;
      }
      this.clear();
      return { kind: 'rejected', response };
    })().finally(() => { this.flight = null; });
    return this.flight;
  }

  private clear() {
    try { this.storage.removeItem(this.storageKey); } catch { /* best effort */ }
    this.pending = null;
    this.blocked = null;
  }
}
