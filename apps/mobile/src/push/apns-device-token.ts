import type { SessionBoundary, SessionEpoch } from '../identity/session-boundary.ts';
import {
  deleteDeviceToken,
  postDeviceToken,
} from './device-token-api.ts';
import {
  secureApnsRegistrationStore,
  type ApnsRegistrationStore,
} from './apns-registration-store.ts';
import type {
  DeviceTokenEnvironment,
  DeviceTokenRegistration,
  LocalDeviceRegistration,
} from './device-token-types.ts';

/**
 * Native APNs device-token registration (ADR-12) + POST/DELETE
 * `/v1/me/device-tokens` when SessionBoundary is verified.
 *
 * Uses `getDevicePushTokenAsync` only — never `getExpoPushTokenAsync` /
 * Expo Push Service (`exp.host`). Never claims `delivered: true`.
 *
 * Expo Notifications / React Native are loaded lazily so unit tests can inject
 * fakes without importing native modules under node:test.
 */

export type ApnsDeviceTokenResult =
  | {
      status: 'ready';
      transport: 'apns';
      /** Opaque APNs device token (hex). Do not log in production paths. */
      token: string;
      /** Present when POST /v1/me/device-tokens succeeded under a live epoch. */
      registration?: DeviceTokenRegistration;
      backend?: 'registered' | 'skipped-unsigned' | 'failed';
    }
  | {
      status: 'permission-denied' | 'unavailable' | 'unsupported' | 'cancelled';
      transport: 'apns';
      reason: string;
    };

/** Bumped on every detach/clear so late register callbacks cannot resurrect UI/state. */
let registrationGeneration = 0;

export function currentApnsRegistrationGeneration(): number {
  return registrationGeneration;
}

/** Test helper — reset generation between cases. */
export function __resetApnsRegistrationGenerationForTests(): void {
  registrationGeneration = 0;
}

/**
 * Maps build entitlement / env to the API `environment` field.
 * `aps-environment=development` → sandbox; production entitlement → production.
 */
export function resolveApnsApiEnvironment(
  env: Record<string, string | undefined> = process.env,
): DeviceTokenEnvironment {
  const raw =
    env.EXPO_PUBLIC_APS_ENVIRONMENT?.trim() ||
    env.APS_ENVIRONMENT?.trim() ||
    env.APP_VARIANT?.trim() ||
    '';
  if (raw === 'production') return 'production';
  return 'sandbox';
}

export type ApnsNotificationsLike = {
  getPermissionsAsync(): Promise<{ status: string }>;
  requestPermissionsAsync(permissions?: unknown): Promise<{ status: string }>;
  getDevicePushTokenAsync(): Promise<{ data: unknown }>;
  setBadgeCountAsync(count: number): Promise<unknown>;
};

export type RegisterApnsDeps = {
  session?: SessionBoundary;
  store?: ApnsRegistrationStore;
  notifications?: ApnsNotificationsLike;
  fetchImpl?: typeof fetch;
  platform?: string;
  resolveEnvironment?: () => DeviceTokenEnvironment;
};

export type ClearApnsDeps = {
  /** Prefer calling while SessionBoundary is still verified (before logout). */
  session?: SessionBoundary;
  store?: ApnsRegistrationStore;
  notifications?: ApnsNotificationsLike;
  fetchImpl?: typeof fetch;
  /** Optional bearer captured before logout if session already signed out. */
  bearer?: string | null;
  /** Logout epoch guard: a late detach must not clear a newer registration. */
  shouldContinue?: () => boolean;
  expectedEpoch?: SessionEpoch;
  /** Only the pre-switch path may detach a persisted local tuple after unreachable restore. */
  allowUnverifiedLocal?: boolean;
  unverifiedExpectedUserId?: string | null;
};

async function defaultNotifications(): Promise<ApnsNotificationsLike> {
  // Release Hermes: `await import('expo-notifications')` throws
  // "Cannot read property 'default' of undefined". Metro `require` is stable.
  // Kept lazy so node:test can inject `notifications` without loading native.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('expo-notifications') as ApnsNotificationsLike & {
    default?: ApnsNotificationsLike;
  };
  const root = mod.default ?? mod;
  if (typeof root.getDevicePushTokenAsync !== 'function') {
    throw new Error(
      `expo-notifications.getDevicePushTokenAsync missing (keys: ${Object.keys(mod).join(',')})`,
    );
  }
  return root;
}

async function defaultPlatform(): Promise<string> {
  // Same Hermes Release pitfall as expo-notifications dynamic import.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Platform } = require('react-native') as {
    Platform: { OS: string };
  };
  return Platform.OS;
}

async function defaultBoundary(): Promise<SessionBoundary> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { session } = require('../identity/session.ts') as {
    session: SessionBoundary;
  };
  return session;
}

/**
 * Request notification permission, read the native APNs device token, and
 * when SessionBoundary is verified POST `/v1/me/device-tokens` under epoch +
 * AbortController guards so logout/account-switch cannot attach a stale token.
 */
export async function registerApnsDeviceToken(
  deps: RegisterApnsDeps = {},
): Promise<ApnsDeviceTokenResult> {
  const platform = deps.platform ?? (await defaultPlatform());
  const notifications = deps.notifications ?? (await defaultNotifications());
  const boundary = deps.session ?? (await defaultBoundary());
  const store = deps.store ?? secureApnsRegistrationStore;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const resolveEnvironment =
    deps.resolveEnvironment ?? (() => resolveApnsApiEnvironment());

  if (platform !== 'ios') {
    return {
      status: 'unsupported',
      transport: 'apns',
      reason: 'APNs device tokens are iOS-only in this build.',
    };
  }

  const genAtStart = registrationGeneration;
  const epoch = boundary.captureEpoch();

  // Device tokens come from UIApplication.registerForRemoteNotifications —
  // no UNUserNotificationCenter permission dialog required. Asking for alert
  // permission under WDA/iOS 26 hung the JS bridge (Promise.race timers never
  // fired). Alert authorization is separate from token minting / worker push.
  let token: string;
  try {
    const device = await Promise.race([
      notifications.getDevicePushTokenAsync(),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('getDevicePushTokenAsync timed out')),
          15_000,
        );
      }),
    ]);
    token =
      typeof device.data === 'string'
        ? device.data.trim()
        : String(device.data ?? '').trim();
  } catch (err) {
    const detail =
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : 'simulator, missing Push Notifications capability, unsigned build, or timed out';
    return {
      status: 'unavailable',
      transport: 'apns',
      reason: `Native APNs device token is unavailable (${detail}).`,
    };
  }

  if (registrationGeneration !== genAtStart) {
    return {
      status: 'cancelled',
      transport: 'apns',
      reason: 'Registration cancelled after logout or account switch.',
    };
  }
  if (!token) {
    return {
      status: 'unavailable',
      transport: 'apns',
      reason: 'APNs returned an empty device token.',
    };
  }

  // Native token ready — backend wire only while the same verified epoch is live.
  if (!epoch || !boundary.isEpochCurrent(epoch)) {
    return {
      status: 'ready',
      transport: 'apns',
      token,
      backend: 'skipped-unsigned',
    };
  }

  const bearer = await boundary.getCredential();
  if (
    registrationGeneration !== genAtStart ||
    !boundary.isEpochCurrent(epoch) ||
    !bearer
  ) {
    return {
      status: 'cancelled',
      transport: 'apns',
      reason: 'Session ended before device-token POST.',
    };
  }

  const controller = boundary.beginRequest();
  try {
    const posted = await postDeviceToken(
      bearer,
      { token, environment: resolveEnvironment() },
      controller.signal,
      fetchImpl,
    );
    const staleAfterPost =
      registrationGeneration !== genAtStart ||
      !boundary.isEpochCurrent(epoch);
    if (staleAfterPost) {
      // POST may have succeeded after clearApns bumped generation (beginRequest
      // is not aborted by clear). Compensate so the old account cannot keep the
      // device token on the server (TD §413 / PRD M09).
      if (posted.status === 'ok') {
        await compensateOrphanServerRegistration({
          bearer,
          registrationId: posted.registration.registrationId,
          userId: epoch.userId,
          environment: posted.registration.environment,
          store,
          fetchImpl,
        });
      }
      return {
        status: 'cancelled',
        transport: 'apns',
        reason: 'Session ended during device-token POST.',
      };
    }
    if (posted.status !== 'ok') {
      return {
        status: 'ready',
        transport: 'apns',
        token,
        backend: 'failed',
      };
    }
    await store.write({
      registrationId: posted.registration.registrationId,
      environment: posted.registration.environment,
      userId: epoch.userId,
    });
    if (
      registrationGeneration !== genAtStart ||
      !boundary.isEpochCurrent(epoch)
    ) {
      await compensateOrphanServerRegistration({
        bearer,
        registrationId: posted.registration.registrationId,
        userId: epoch.userId,
        environment: posted.registration.environment,
        store,
        fetchImpl,
      });
      return {
        status: 'cancelled',
        transport: 'apns',
        reason: 'Session ended after device-token POST.',
      };
    }
    return {
      status: 'ready',
      transport: 'apns',
      token,
      registration: posted.registration,
      backend: 'registered',
    };
  } finally {
    boundary.endRequest(controller);
  }
}

/**
 * Best-effort DELETE + local clear when a registration landed on the server
 * after detach/account-switch invalidated the client generation/epoch.
 * Uses the bearer captured for the original POST (may still be valid before logout).
 */
async function compensateOrphanServerRegistration(input: {
  bearer: string;
  registrationId: string;
  userId: string;
  environment: DeviceTokenEnvironment;
  store: ApnsRegistrationStore;
  fetchImpl: typeof fetch;
}): Promise<void> {
  const tuple: LocalDeviceRegistration = {
    userId: input.userId, registrationId: input.registrationId,
    environment: input.environment,
  };
  await input.store.retainPending(tuple);
  const deleted = await deleteDeviceToken(input.bearer, input.registrationId, undefined, input.fetchImpl);
  if (deleted.status !== 'ok' && deleted.status !== 'not-found') {
    throw new Error('Chưa xác nhận gỡ đăng ký thông báo. Vui lòng thử lại.');
  }
  await input.store.clearIfMatches(tuple);
}

/**
 * Detach push registration for logout / account-switch:
 * 1) Bump generation (cancel in-flight register)
 * 2) Best-effort DELETE `/v1/me/device-tokens/{id}` while bearer still available
 * 3) Clear local registration SecureStore
 * 4) Clear badge
 *
 * Call **before** `session.logout()` so the bearer is still readable.
 */
export async function clearApnsRegistrationState(
  deps: ClearApnsDeps = {},
): Promise<void> {
  if (deps.expectedEpoch && deps.session && !deps.session.isEpochCurrent(deps.expectedEpoch)) return;
  registrationGeneration += 1;
  const boundary = deps.session ?? (await defaultBoundary());
  const store = deps.store ?? secureApnsRegistrationStore;
  const notifications = deps.notifications ?? (await defaultNotifications());
  const fetchImpl = deps.fetchImpl ?? fetch;
  const epoch = deps.expectedEpoch ?? boundary.captureEpoch();
  if (deps.expectedEpoch && !boundary.isEpochCurrent(deps.expectedEpoch)) return;
  const local = await store.read();
  if (deps.allowUnverifiedLocal && !epoch && local && local.userId !== deps.unverifiedExpectedUserId) {
    throw new Error('Chưa xác nhận chủ đăng ký thông báo. Vui lòng thử lại.');
  }
  const userId = epoch?.userId ?? (deps.allowUnverifiedLocal ? deps.unverifiedExpectedUserId : null);
  if (deps.allowUnverifiedLocal && !epoch && await store.hasPendingOutside(userId ?? null)) {
    throw new Error('Chưa xác nhận gỡ đăng ký thông báo của phiên trước. Vui lòng thử lại.');
  }
  const pending = userId ? await store.pendingFor(userId) : [];
  if (deps.shouldContinue && !deps.shouldContinue()) return;

  const bearer =
    deps.bearer !== undefined
      ? deps.bearer
      : await boundary.getCredential();
  if (deps.shouldContinue && !deps.shouldContinue()) return;
  const targets = [...pending];
  if (userId && local?.userId === userId && !targets.some((item) => item.registrationId === local.registrationId)) targets.push(local);
  if (targets.length && !bearer) throw new Error('Chưa thể gỡ đăng ký thông báo. Vui lòng thử lại.');
  for (const target of targets) {
    await store.retainPending(target);
    const deleted = await deleteDeviceToken(bearer!, target.registrationId, undefined, fetchImpl);
    if (deleted.status !== 'ok' && deleted.status !== 'not-found') {
      throw new Error('Chưa xác nhận gỡ đăng ký thông báo. Vui lòng thử lại.');
    }
    await store.clearIfMatches(target);
  }

  if (deps.shouldContinue && !deps.shouldContinue()) return;
  try {
    await notifications.setBadgeCountAsync(0);
  } catch {
    /* best-effort */
  }
}
