import type { SessionBoundary } from './session-boundary.ts';
import { probeMeEvents } from './fetch-me-events.ts';

/**
 * Ephemeral UI signal for O02 Nhân viên chrome.
 * Never persist `staffEligible: true` to SecureStore — server MeEvents is SoT.
 */
export type StaffEligibilitySnapshot = {
  /** Deny-by-default until MeEvents says true. */
  staffEligible: boolean;
  /** True after a completed check for the current identity generation. */
  resolved: boolean;
  /** In-flight MeEvents probe. */
  loading: boolean;
};

const DEFAULT_SNAPSHOT: StaffEligibilitySnapshot = {
  staffEligible: false,
  resolved: false,
  loading: false,
};

export const staffDenyCopy = {
  title: 'Không có quyền Nhân viên',
  body: 'Tài khoản này chưa được cấp quyền nhân viên. Tab Nhân viên đã ẩn. Liên hệ quản trị viên sự kiện nếu bạn cần quét cổng.',
  announcement:
    'Không có quyền Nhân viên. Tab Nhân viên đã ẩn. Không cho vào khu vực staff.',
} as const;

/**
 * Authz codes that must clear staff chrome immediately (SEC-CACHE / O02 §5–6).
 * Does not invent eligibility — only decides when to fail-closed the tab.
 */
export function isMembershipAuthzDenial(
  status: number,
  body: unknown,
): boolean {
  if (status === 401) return true;
  if (status !== 403) return false;
  if (!body || typeof body !== 'object') return false;
  const code = (body as Record<string, unknown>).code;
  if (typeof code !== 'string') return false;
  return code.startsWith('MEMBERSHIP_') || code === 'PERMISSION_DENIED';
}

type Listener = () => void;

/**
 * In-memory eligibility for tab chrome + soft-deny.
 * Signed-out / unknown / probe failure → not eligible (fail-closed).
 * Never persists `staffEligible: true` — revoke must not leave a sticky tab.
 */
export class StaffEligibilityStore {
  private snapshot: StaffEligibilitySnapshot = { ...DEFAULT_SNAPSHOT };
  private listeners = new Set<Listener>();
  private requestId = 0;
  private inFlight: AbortController | null = null;

  getSnapshot = (): StaffEligibilitySnapshot => this.snapshot;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(next: StaffEligibilitySnapshot) {
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  /**
   * Immediate fail-closed chrome (logout / unsigned / MEMBERSHIP_* 401/403).
   * Aborts in-flight MeEvents so a late 200 cannot restore a revoked tab.
   */
  reset() {
    this.requestId += 1;
    this.inFlight?.abort();
    this.inFlight = null;
    this.publish({ ...DEFAULT_SNAPSHOT, resolved: true });
  }

  /**
   * Revalidate from GET /v1/me/events for the current verified session.
   * Unauthorized / unreachable / invalid → hide staff (safer O02 + SEC-CACHE).
   */
  async refresh(session: SessionBoundary): Promise<StaffEligibilitySnapshot> {
    const epoch = session.captureEpoch();
    if (!epoch) {
      this.reset();
      return this.snapshot;
    }

    const requestId = ++this.requestId;
    this.inFlight?.abort();
    const controller = session.beginRequest();
    this.inFlight = controller;
    // Fail-closed while probing — never keep a prior staffEligible=true sticky.
    this.publish({
      staffEligible: false,
      resolved: false,
      loading: true,
    });

    try {
      const bearer = await session.getCredential();
      if (requestId !== this.requestId) return this.snapshot;
      if (!session.isEpochCurrent(epoch) || !bearer) {
        this.reset();
        return this.snapshot;
      }

      const result = await probeMeEvents(bearer, controller.signal);
      if (requestId !== this.requestId) return this.snapshot;
      if (!session.isEpochCurrent(epoch)) {
        this.reset();
        return this.snapshot;
      }

      if (result.status === 'unauthorized') {
        this.reset();
        return this.snapshot;
      }

      const eligible =
        result.status === 'ok' && result.body.staffEligible === true;
      this.publish({
        staffEligible: eligible,
        resolved: true,
        loading: false,
      });
      return this.snapshot;
    } catch {
      if (requestId !== this.requestId) return this.snapshot;
      this.publish({
        staffEligible: false,
        resolved: true,
        loading: false,
      });
      return this.snapshot;
    } finally {
      session.endRequest(controller);
      if (this.inFlight === controller) this.inFlight = null;
    }
  }
}

export const staffEligibility = new StaffEligibilityStore();

/**
 * Pure helper for unit tests / chrome mapping.
 * Missing or non-true → not eligible.
 */
export function staffEligibleFromMeEvents(
  body: { staffEligible?: unknown } | null | undefined,
): boolean {
  return body?.staffEligible === true;
}
