import {
  accessTokenNeedsRefresh,
  encodeStoredCredential,
  parseStoredCredential,
  type SessionTokenParts,
} from './credential-envelope.ts';
import {
  refreshOidcTokens,
  type RefreshOidcTokens,
} from './oidc-refresh.ts';

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

type FreshAccessOutcome =
  | { status: 'token'; accessToken: string }
  | { status: 'missing' }
  | { status: 'signed-out' }
  | { status: 'unreachable' };

/** Result of resolving a bearer for API calls while verified. */
export type CredentialResolveResult =
  | { status: 'token'; accessToken: string }
  /** IdP refresh failed (network); do not treat downstream 401 as true revoke. */
  | { status: 'refresh-unreachable' }
  | { status: 'unavailable' };

export class SessionBoundary {
  private identity: Identity = { status: 'unknown' };
  private generation = 0;
  private cache = new Map<string, unknown>();
  private requests = new Set<AbortController>();
  private listeners = new Set<() => void>();
  private storageQueue: Promise<unknown> = Promise.resolve();
  private refreshInFlight: Promise<FreshAccessOutcome> | null = null;

  private store: CredentialStore;
  private refreshTokens: RefreshOidcTokens;
  private beforeVerified?: (userId: string, generation: number, isCurrent: () => boolean) => Promise<void>;
  private beforeSwitch?: (context: { epoch: SessionEpoch | null; bearer: string | null }) => Promise<void>;
  constructor(
    store: CredentialStore,
    refreshTokens: RefreshOidcTokens = refreshOidcTokens,
    hooks: {
      beforeVerified?: (userId: string, generation: number, isCurrent: () => boolean) => Promise<void>;
      beforeSwitch?: (context: { epoch: SessionEpoch | null; bearer: string | null }) => Promise<void>;
    } = {},
  ) {
    this.store = store;
    this.refreshTokens = refreshTokens;
    this.beforeVerified = hooks.beforeVerified;
    this.beforeSwitch = hooks.beforeSwitch;
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

  /**
   * Read SecureStore, refresh when the access token is near expiry, return a
   * usable bearer. Coalesces concurrent refresh attempts.
   */
  private async ensureFreshAccessToken(): Promise<FreshAccessOutcome> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = this.runEnsureFreshAccessToken().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  private async runEnsureFreshAccessToken(): Promise<FreshAccessOutcome> {
    const generation = this.generation;
    const raw = await this.storage(() => this.store.read());
    if (!raw) return { status: 'missing' };
    const envelope = parseStoredCredential(raw);
    if (!accessTokenNeedsRefresh(envelope)) {
      return { status: 'token', accessToken: envelope.accessToken };
    }

    const refreshToken = envelope.refreshToken;
    if (!refreshToken) {
      return { status: 'token', accessToken: envelope.accessToken };
    }

    const refreshed = await this.refreshTokens(refreshToken);
    if (generation !== this.generation) return { status: 'missing' };

    if (refreshed.ok) {
      const stored = encodeStoredCredential({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresIn: refreshed.expiresIn,
      });
      await this.storage(() => this.store.write(stored));
      if (generation !== this.generation) return { status: 'missing' };
      return { status: 'token', accessToken: refreshed.accessToken };
    }

    if (refreshed.reason === 'network') {
      // Keep prior credential; callers may still attempt the API or treat as unreachable.
      return { status: 'unreachable' };
    }

    // auth / config: clear and drop verified identity — UI must sign in again.
    this.invalidate({ status: 'signed-out' });
    await this.storage(() => this.store.clear());
    return { status: 'signed-out' };
  }

  /** Keychain restoration alone never establishes identity. */
  async restore(verify?: VerifyCredential): Promise<RestoreOutcome> {
    const generation = this.invalidate({ status: 'unknown' });
    try {
      const fresh = await this.ensureFreshAccessToken();
      // Refresh auth-failure invalidates (bumps generation) — treat before mismatch.
      if (fresh.status === 'signed-out') {
        this.publish({ status: 'signed-out' });
        return 'signed-out';
      }
      if (generation !== this.generation) return 'unknown';
      if (fresh.status === 'unreachable') {
        // Network refresh failure: keep SecureStore credential, never elevate.
        this.publish({ status: 'signed-out' });
        return 'unreachable';
      }
      if (fresh.status === 'missing') {
        await this.storage(() => this.store.clear());
        if (generation === this.generation) {
          this.publish({ status: 'signed-out' });
          return 'signed-out';
        }
        return 'unknown';
      }

      const verified = verify ? await verify(fresh.accessToken) : null;
      if (generation !== this.generation) return 'unknown';
      if (verified === CREDENTIAL_UNREACHABLE) {
        // Network/unreachable: keep credential for a later online probe.
        // Never treat local keychain presence as verified identity.
        this.publish({ status: 'signed-out' });
        return 'unreachable';
      }
      if (verified && typeof verified === 'object' && verified.userId) {
        await this.beforeVerified?.(verified.userId, generation, () => generation === this.generation);
        if (generation !== this.generation) return 'unknown';
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
  /**
   * Integration seam, not a login implementation. Never accept a user ID from UI.
   * Optional `tokens` persists refresh + expiry beside the access token (JSON envelope).
   */
  async establish(
    accessToken: string,
    verify: VerifyCredential,
    tokens?: Omit<SessionTokenParts, 'accessToken'>,
  ) {
    const startGeneration = this.generation;
    const previous = this.captureEpoch();
    const previousRaw = await this.storage(() => this.store.read());
    const previousBearer = previous
      ? await this.getCredential()
      : previousRaw ? parseStoredCredential(previousRaw).accessToken : null;
    if (previous || previousRaw) await this.beforeSwitch?.({ epoch: previous, bearer: previousBearer });
    if (startGeneration !== this.generation) throw new Error('Phiên đăng nhập đã đổi. Vui lòng thử lại.');
    const generation = this.invalidate({ status: 'unknown' });
    // Remove the preceding account's credential even if verification fails.
    await this.storage(() => this.store.clear());
    const verified = await verify(accessToken);
    if (generation !== this.generation) return;
    const stored = encodeStoredCredential({
      accessToken,
      refreshToken: tokens?.refreshToken,
      expiresIn: tokens?.expiresIn,
    });
    if (verified === CREDENTIAL_UNREACHABLE) {
      // OIDC succeeded but /v1/me unreachable (missing API bake, brief outage).
      // Keep the new bearer for a later online restore — never elevate offline.
      await this.storage(() => this.store.write(stored));
      if (generation === this.generation) {
        this.publish({ status: 'signed-out' });
      }
      return;
    }
    if (!verified || typeof verified !== 'object' || !verified.userId) {
      this.publish({ status: 'signed-out' });
      return;
    }
    try {
      await this.beforeVerified?.(verified.userId, generation, () => generation === this.generation);
    } catch (error) {
      if (generation === this.generation) this.publish({ status: 'unknown' });
      throw error;
    }
    if (generation !== this.generation) return;
    await this.storage(() => this.store.write(stored));
    if (generation === this.generation)
      this.publish({ status: 'verified', userId: verified.userId });
  }
  async logout() {
    this.invalidate({ status: 'signed-out' });
    // Propagate deletion failures: callers must not claim durable logout succeeded.
    await this.storage(() => this.store.clear());
  }
  /**
   * Resolve bearer for API calls with an explicit signal when refresh failed
   * due to network (avoids handing an expired access token that would 401).
   */
  async resolveCredential(): Promise<CredentialResolveResult> {
    if (this.identity.status !== 'verified') {
      return { status: 'unavailable' };
    }
    const fresh = await this.ensureFreshAccessToken();
    if (this.identity.status !== 'verified') {
      return { status: 'unavailable' };
    }
    if (fresh.status === 'token') {
      return { status: 'token', accessToken: fresh.accessToken };
    }
    if (fresh.status === 'unreachable') {
      return { status: 'refresh-unreachable' };
    }
    return { status: 'unavailable' };
  }

  /**
   * Short-lived bearer for authenticated API calls. Only available while
   * SessionBoundary is verified — never invents a token from UI state.
   * Transparently refreshes when the stored access token is near expiry.
   */
  async getCredential(): Promise<string | null> {
    const resolved = await this.resolveCredential();
    if (resolved.status === 'token') return resolved.accessToken;
    return null;
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
