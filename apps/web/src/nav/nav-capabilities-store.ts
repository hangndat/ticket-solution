'use client';

import {
  GUEST_NAV_LINKS,
  type NavCapabilities,
  type NavLink,
} from './capabilities';
import { loadNavCapabilities } from './load-nav-capabilities';
import { isMembershipAuthzDenial } from './membership-authz';

export type NavCapabilitiesSnapshot = {
  caps: NavCapabilities;
  links: NavLink[];
  /** True after a completed discovery (or explicit reset). */
  resolved: boolean;
  loading: boolean;
};

export type NavCapabilitiesLoader = () => Promise<{
  caps: NavCapabilities;
  links: NavLink[];
}>;

const GUEST_CAPS: NavCapabilities = {
  authenticated: false,
  showPortalStaff: false,
  showGate: false,
  showAccount: false,
};

type Listener = () => void;

/**
 * Ephemeral in-memory SiteNav capabilities (O02 + SEC-CACHE).
 * Never persist staff chrome — revoke must not leave sticky Admin/Cổng links.
 */
export class NavCapabilitiesStore {
  private snapshot: NavCapabilitiesSnapshot = {
    caps: GUEST_CAPS,
    links: [...GUEST_NAV_LINKS],
    resolved: false,
    loading: false,
  };
  private listeners = new Set<Listener>();
  private requestId = 0;
  private refreshing = false;
  private readonly loader: NavCapabilitiesLoader;

  constructor(loader: NavCapabilitiesLoader = loadNavCapabilities) {
    this.loader = loader;
  }

  getSnapshot = (): NavCapabilitiesSnapshot => this.snapshot;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Test / internal: publish a snapshot without discovery. */
  replaceSnapshot(next: NavCapabilitiesSnapshot) {
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  private publish(next: NavCapabilitiesSnapshot) {
    this.replaceSnapshot(next);
  }

  /**
   * Immediate fail-closed chrome (logout / MEMBERSHIP_* 401/403).
   * Bumps requestId so an in-flight refresh cannot restore revoked links.
   */
  reset() {
    this.requestId += 1;
    this.publish({
      caps: GUEST_CAPS,
      links: [...GUEST_NAV_LINKS],
      resolved: true,
      loading: false,
    });
  }

  /**
   * Revalidate MeEvents / MeTenants / PlatformMe.
   * Fail-closed while probing — never keep prior staff links sticky.
   */
  async refresh(): Promise<NavCapabilitiesSnapshot> {
    const requestId = ++this.requestId;
    this.refreshing = true;
    this.publish({
      caps: GUEST_CAPS,
      links: [...GUEST_NAV_LINKS],
      resolved: false,
      loading: true,
    });

    try {
      const { caps, links } = await this.loader();
      if (requestId !== this.requestId) return this.snapshot;
      this.publish({
        caps,
        links,
        resolved: true,
        loading: false,
      });
      return this.snapshot;
    } catch {
      if (requestId !== this.requestId) return this.snapshot;
      this.publish({
        caps: GUEST_CAPS,
        links: [...GUEST_NAV_LINKS],
        resolved: true,
        loading: false,
      });
      return this.snapshot;
    } finally {
      if (requestId === this.requestId) {
        this.refreshing = false;
      }
    }
  }

  /**
   * SEC-CACHE: clear chrome on MEMBERSHIP_* / PERMISSION_DENIED 401/403,
   * then refetch discovery unless already refreshing (avoids loop / abort).
   */
  handleAuthzDenial(status: number, body: unknown): void {
    if (!isMembershipAuthzDenial(status, body)) return;
    if (this.refreshing) {
      // Soft-clear sticky staff links without aborting in-flight discovery.
      this.publish({
        caps: GUEST_CAPS,
        links: [...GUEST_NAV_LINKS],
        resolved: false,
        loading: true,
      });
      return;
    }
    this.reset();
    void this.refresh();
  }
}

export const navCapabilitiesStore = new NavCapabilitiesStore();

/** Test helper — avoid sticky singleton state across cases. */
export function resetNavCapabilitiesStoreForTests(): void {
  navCapabilitiesStore.reset();
}
