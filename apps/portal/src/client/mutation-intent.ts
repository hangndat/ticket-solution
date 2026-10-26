import { apiErrorCode, type PortalFetchResult } from './portal-fetch';

export type IntentScope = {
  actorId: string;
  tenantId: string;
  eventId?: string;
  command: string;
};

export type PendingIntent = {
  key: string;
  fingerprint: string;
  salt: string;
  createdAt: number;
  state: 'sending' | 'unknown' | 'accepted' | 'conflict';
  attempts?: number;
  retryAt?: number;
};

export type IntentResult =
  | { kind: 'response'; response: PortalFetchResult; key: string }
  | { kind: 'blocked'; reason: 'changed' | 'recovered' | 'stale' | 'conflict' | 'accepted' | 'backoff' | 'identity' };

export interface IntentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PREFIX = 'portal.mutation-intent.v1:';
// A conservative client retry window, not a statement about backend key retention.
const RETRY_TRUST_WINDOW_MS = 5 * 60_000;

export function intentStorageKey(scope: IntentScope): string {
  return PREFIX + JSON.stringify([scope.actorId, scope.tenantId, scope.eventId ?? '', scope.command]);
}

async function fingerprint(payload: unknown, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${JSON.stringify(payload)}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parsePending(raw: string | null): PendingIntent | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const item = value as Partial<PendingIntent>;
    if (
      typeof item.key !== 'string' ||
      typeof item.fingerprint !== 'string' ||
      typeof item.salt !== 'string' ||
      typeof item.createdAt !== 'number' ||
      !['sending', 'unknown', 'accepted', 'conflict'].includes(item.state ?? '')
    ) return null;
    return item as PendingIntent;
  } catch {
    return null;
  }
}

/** One controller per actor/tenant/event/command. Storage contains only a digest and key, never payload or PII. */
export class MutationIntent {
  private readonly storageKey: string;
  private recovered: boolean;
  private unreadable = false;
  private pending: PendingIntent | null;
  private inFlight: Promise<IntentResult> | null = null;

  constructor(
    scope: IntentScope,
    private readonly storage: IntentStorage,
    private readonly newKey: () => string = () => crypto.randomUUID(),
    private readonly now: () => number = () => Date.now(),
  ) {
    this.storageKey = intentStorageKey(scope);
    const raw = storage.getItem(this.storageKey);
    this.pending = parsePending(raw);
    if (raw !== null && !this.pending) {
      this.unreadable = true;
      this.pending = { key: '', salt: '', fingerprint: '', createdAt: this.now(), state: 'conflict' };
    }
    // A request interrupted by reload can have committed. It needs read-side reconciliation.
    this.recovered = this.pending !== null;
  }

  get status(): PendingIntent | null { return this.pending; }
  get needsReconciliation(): boolean { return this.recovered && this.pending !== null; }

  private save(pending: PendingIntent | null): void {
    this.pending = pending;
    if (pending) this.storage.setItem(this.storageKey, JSON.stringify(pending));
    else this.storage.removeItem(this.storageKey);
  }

  /** Call only after a GET proves the operation's terminal result, or explicit user confirmation. */
  release(): void {
    if (this.inFlight) return;
    this.unreadable = false;
    this.recovered = false;
    this.save(null);
  }

  run(
    payload: object,
    send: (body: Record<string, unknown>) => Promise<PortalFetchResult>,
    definitive?: (response: PortalFetchResult) => boolean,
  ): Promise<IntentResult> {
    // Assign the promise before hashing so two clicks cannot create two keys.
    if (this.inFlight) return this.inFlight;
    const flight = this.execute(payload, send, definitive);
    this.inFlight = flight;
    void flight.then(() => {
      if (this.inFlight === flight) this.inFlight = null;
    }, () => {
      if (this.inFlight === flight) this.inFlight = null;
    });
    return flight;
  }

  private async execute(
    payload: object,
    send: (body: Record<string, unknown>) => Promise<PortalFetchResult>,
    definitive?: (response: PortalFetchResult) => boolean,
  ): Promise<IntentResult> {
    const prior = this.pending;
    if (this.unreadable) return { kind: 'blocked', reason: 'conflict' };
    const salt = prior?.salt ?? crypto.randomUUID();
    const hash = await fingerprint(payload, salt);
    if (prior) {
      if (prior.state === 'conflict') return { kind: 'blocked', reason: 'conflict' };
      if (prior.state === 'accepted') return { kind: 'blocked', reason: 'accepted' };
      if (prior.fingerprint !== hash) return { kind: 'blocked', reason: 'changed' };
      if (this.recovered) return { kind: 'blocked', reason: 'recovered' };
      if (this.now() - prior.createdAt > RETRY_TRUST_WINDOW_MS) return { kind: 'blocked', reason: 'stale' };
      if (prior.retryAt && this.now() < prior.retryAt) return { kind: 'blocked', reason: 'backoff' };
    }
    const intent: PendingIntent = prior ?? {
      key: this.newKey(), fingerprint: hash, salt, createdAt: this.now(), state: 'sending',
    };
    this.save({ ...intent, state: 'sending', retryAt: undefined });
    const body = { ...payload, idempotencyKey: intent.key };
    let response: PortalFetchResult;
    try {
      response = await send(body);
    } catch {
      response = { status: 0, json: null, networkError: true, timedOut: false };
    }
    const code = apiErrorCode(response.json) ?? '';
    if (response.status === 409 || code === 'IDEMPOTENCY_CONFLICT' || /IDEMPOTENCY.*(EXPIRED|MISMATCH)/.test(code)) {
      this.save({ ...intent, state: 'conflict' });
    } else if (response.status === 202) {
      this.save({ ...intent, state: 'accepted' });
    } else if (response.status === 429) {
      const attempts = (intent.attempts ?? 0) + 1;
      const fallback = Math.min(1000 * 2 ** Math.min(attempts - 1, 5), 30_000);
      this.save({ ...intent, attempts, retryAt: this.now() + (response.retryAfterMs ?? fallback), state: 'unknown' });
    } else if (response.networkError || response.timedOut || response.status === 0 || response.status >= 500 ||
      (response.json !== null && typeof response.json === 'object' &&
        (response.json as { retryable?: unknown }).retryable === true) ||
      (response.status >= 200 && response.status < 300 && definitive && !definitive(response))) {
      this.save({ ...intent, state: 'unknown' });
    } else {
      this.save(null);
    }
    return { kind: 'response', response, key: intent.key };
  }
}
