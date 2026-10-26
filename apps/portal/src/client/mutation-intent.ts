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
  createdAt: number;
  state: 'sending' | 'unknown' | 'conflict';
};

export type IntentResult =
  | { kind: 'response'; response: PortalFetchResult; key: string }
  | { kind: 'blocked'; reason: 'changed' | 'recovered' | 'conflict' | 'identity' };

export interface IntentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PREFIX = 'portal.mutation-intent.v1:';

export function intentStorageKey(scope: IntentScope): string {
  return PREFIX + JSON.stringify([scope.actorId, scope.tenantId, scope.eventId ?? '', scope.command]);
}

async function fingerprint(payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
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
      typeof item.createdAt !== 'number' ||
      !['sending', 'unknown', 'conflict'].includes(item.state ?? '')
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
  private pending: PendingIntent | null;
  private inFlight: Promise<IntentResult> | null = null;

  constructor(
    scope: IntentScope,
    private readonly storage: IntentStorage,
    private readonly newKey: () => string = () => crypto.randomUUID(),
    private readonly now: () => number = () => Date.now(),
  ) {
    this.storageKey = intentStorageKey(scope);
    this.pending = parsePending(storage.getItem(this.storageKey));
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
    this.recovered = false;
    this.save(null);
  }

  run(
    payload: object,
    send: (body: Record<string, unknown>) => Promise<PortalFetchResult>,
  ): Promise<IntentResult> {
    // Assign the promise before hashing so two clicks cannot create two keys.
    if (this.inFlight) return this.inFlight;
    const flight = this.execute(payload, send);
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
  ): Promise<IntentResult> {
    const hash = await fingerprint(payload);
    const prior = this.pending;
    if (prior) {
      if (prior.state === 'conflict') return { kind: 'blocked', reason: 'conflict' };
      if (prior.fingerprint !== hash) return { kind: 'blocked', reason: 'changed' };
      if (this.recovered) return { kind: 'blocked', reason: 'recovered' };
    }
    const intent: PendingIntent = prior ?? {
      key: this.newKey(), fingerprint: hash, createdAt: this.now(), state: 'sending',
    };
    this.save({ ...intent, state: 'sending' });
    const body = { ...payload, idempotencyKey: intent.key };
    let response: PortalFetchResult;
    try {
      response = await send(body);
    } catch {
      response = { status: 0, json: null, networkError: true, timedOut: false };
    }
    const code = apiErrorCode(response.json) ?? '';
    if (code === 'IDEMPOTENCY_CONFLICT' || /IDEMPOTENCY.*(EXPIRED|MISMATCH)/.test(code)) {
      this.save({ ...intent, state: 'conflict' });
    } else if (response.networkError || response.timedOut || response.status === 0 || response.status >= 500 ||
      (response.json !== null && typeof response.json === 'object' &&
        (response.json as { retryable?: unknown }).retryable === true)) {
      this.save({ ...intent, state: 'unknown' });
    } else {
      this.save(null);
    }
    return { kind: 'response', response, key: intent.key };
  }
}
