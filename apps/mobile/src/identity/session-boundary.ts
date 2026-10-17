export interface CredentialStore {
  read(): Promise<string | null>;
  write(credential: string): Promise<void>;
  clear(): Promise<void>;
}
export type Identity =
  | { status: 'unknown' }
  | { status: 'signed-out' }
  | { status: 'verified'; userId: string };

/**
 * Probe returned when the auth server cannot be reached.
 * Restore keeps the SecureStore credential but never elevates to verified.
 * Establish treats this like a failed verification (signed-out, no write).
 */
export const CREDENTIAL_UNREACHABLE = Symbol('ticket.credentialUnreachable');

/** Only a server-validated provider adapter may produce this result. */
export type VerifyCredential = (
  credential: string,
) => Promise<
  { userId: string } | null | typeof CREDENTIAL_UNREACHABLE
>;

export type RestoreOutcome =
  | 'verified'
  | 'signed-out'
  | 'unreachable'
  | 'unknown';

/** Generation + verified user captured before an async ticket/API operation. */
export type SessionEpoch = {
  generation: number;
  userId: string;
};

export class SessionBoundary {
  private identity: Identity = { status: 'unknown' };
  private generation = 0;
  private cache = new Map<string, unknown>();
  private requests = new Set<AbortController>();
  private listeners = new Set<() => void>();
  private storageQueue: Promise<unknown> = Promise.resolve();

  private store: CredentialStore;
  constructor(store: CredentialStore) {
    this.store = store;
  }
  getSnapshot = (): Identity => this.identity;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(identity: Identity) {
    this.identity = identity;
    for (const listener of this.listeners) listener();
  }
  private invalidate(identity: Identity) {
    this.generation++;
    for (const request of this.requests) request.abort();
    this.requests.clear();
    this.cache.clear();
    this.publish(identity);
    return this.generation;
  }
  private storage<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.storageQueue.then(operation);
    this.storageQueue = result.catch(() => undefined);
    return result;
  }

  /**
   * Capture verified generation+user before any async read/write/fetch.
   * Returns null when not verified — callers must not proceed with online sync.
   */
  captureEpoch(): SessionEpoch | null {
    if (this.identity.status !== 'verified') return null;
    return { generation: this.generation, userId: this.identity.userId };
  }

  /** True only when the same verified user and generation are still current. */
  isEpochCurrent(epoch: SessionEpoch | null): boolean {
    if (!epoch) return false;
    return (
      this.generation === epoch.generation &&
      this.identity.status === 'verified' &&
      this.identity.userId === epoch.userId
    );
  }

  /**
   * Register an AbortController aborted on logout/account-switch invalidate.
   * Call `endRequest` in a finally block so the set does not leak.
   */
  beginRequest(): AbortController {
    const controller = new AbortController();
    this.requests.add(controller);
    return controller;
  }

  endRequest(controller: AbortController): void {
    this.requests.delete(controller);
  }

  /** Keychain restoration alone never establishes identity. */
  async restore(verify?: VerifyCredential): Promise<RestoreOutcome> {
    const generation = this.invalidate({ status: 'unknown' });
    try {
      const credential = await this.storage(() => this.store.read());
      const verified = credential && verify ? await verify(credential) : null;
      if (generation !== this.generation) return 'unknown';
      if (verified === CREDENTIAL_UNREACHABLE) {
        // Network/unreachable: keep credential for a later online probe.
        // Never treat local keychain presence as verified identity.
        this.publish({ status: 'signed-out' });
        return 'unreachable';
      }
      if (verified && typeof verified === 'object' && verified.userId) {
        this.publish({ status: 'verified', userId: verified.userId });
        return 'verified';
      }
      await this.storage(() => this.store.clear());
      if (generation === this.generation) {
        this.publish({ status: 'signed-out' });
        return 'signed-out';
      }
      return 'unknown';
    } catch (error) {
      if (generation === this.generation) this.publish({ status: 'unknown' });
      throw error;
    }
  }
  /** Integration seam, not a login implementation. Never accept a user ID from UI. */
  async establish(credential: string, verify: VerifyCredential) {
    const generation = this.invalidate({ status: 'unknown' });
    // Remove the preceding account's credential even if verification fails.
    await this.storage(() => this.store.clear());
    const verified = await verify(credential);
    if (generation !== this.generation) return;
    if (verified === CREDENTIAL_UNREACHABLE) {
      // OIDC succeeded but /v1/me unreachable (missing API bake, brief outage).
      // Keep the new bearer for a later online restore — never elevate offline.
      await this.storage(() => this.store.write(credential));
      if (generation === this.generation) {
        this.publish({ status: 'signed-out' });
      }
      return;
    }
    if (!verified || typeof verified !== 'object' || !verified.userId) {
      this.publish({ status: 'signed-out' });
      return;
    }
    await this.storage(() => this.store.write(credential));
    if (generation === this.generation)
      this.publish({ status: 'verified', userId: verified.userId });
  }
  async logout() {
    this.invalidate({ status: 'signed-out' });
    // Propagate deletion failures: callers must not claim durable logout succeeded.
    await this.storage(() => this.store.clear());
  }
  /**
   * Short-lived bearer for authenticated API calls. Only available while
   * SessionBoundary is verified — never invents a token from UI state.
   */
  async getCredential(): Promise<string | null> {
    if (this.identity.status !== 'verified') return null;
    return this.storage(() => this.store.read());
  }
  private key(tenantSlug: string, resource: string) {
    if (this.identity.status !== 'verified') return null;
    return JSON.stringify([this.identity.userId, tenantSlug, resource]);
  }
  read<T>(tenantSlug: string, resource: string): T | undefined {
    const key = this.key(tenantSlug, resource);
    return key ? (this.cache.get(key) as T | undefined) : undefined;
  }
  /** Even a loader ignoring cancellation cannot hydrate a later account/session. */
  async load<T>(
    tenantSlug: string,
    resource: string,
    loader: (signal: AbortSignal) => Promise<T>,
  ) {
    const key = this.key(tenantSlug, resource);
    if (!key) throw new Error('Verified identity required');
    const generation = this.generation;
    const controller = new AbortController();
    this.requests.add(controller);
    try {
      const value = await loader(controller.signal);
      if (generation !== this.generation || controller.signal.aborted)
        return false;
      this.cache.set(key, value);
      return true;
    } finally {
      this.requests.delete(controller);
    }
  }
}
