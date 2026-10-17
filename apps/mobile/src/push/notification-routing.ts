import type { SessionBoundary } from '../identity/session-boundary.ts';
import {
  clearNotificationTapIntent,
  dropNotificationTapIntentIfStale,
  markResponseConsumed,
  peekNotificationTapIntent,
  resumeNotificationTapIntent,
} from './notification-intent.ts';
import {
  createExpoNotificationResponseTransport,
  handleNotificationResponse,
  startNotificationResponseHandling,
  type HandleNotificationResponseResult,
  type NotificationNavigate,
  type NotificationResponseController,
  type NotificationResponseTransport,
} from './notification-response.ts';
import {
  resolveNotificationRoute,
  type NotificationResolveDeps,
} from './notification-resolve.ts';

export type NotificationRoutingDeps = {
  session: SessionBoundary;
  navigate: NotificationNavigate;
  /** Injected transport is explicitly test-only when provided. */
  transport?: NotificationResponseTransport;
  resolveExtras?: Omit<NotificationResolveDeps, 'session'>;
};

export type NotificationRoutingHandle = {
  stop(): void;
  /** Call after session restore / identity change. */
  onSessionChanged(): Promise<HandleNotificationResponseResult | null>;
};

/**
 * Start cold/warm notification response handling and resume parked intents
 * when a verified epoch becomes current. Does not gate wallet UI.
 */
export async function attachNotificationRouting(
  deps: NotificationRoutingDeps,
): Promise<NotificationRoutingHandle> {
  const transport =
    deps.transport ?? (await createExpoNotificationResponseTransport());

  const resolveDeps: NotificationResolveDeps = {
    session: deps.session,
    ...deps.resolveExtras,
  };

  const controller: NotificationResponseController =
    startNotificationResponseHandling(transport, {
      ...resolveDeps,
      navigate: deps.navigate,
    });

  // Cold start: consume last response once.
  void controller.consumeLast();

  const unsub = deps.session.subscribe(() => {
    void onSessionChangedInternal();
  });

  async function onSessionChangedInternal(): Promise<HandleNotificationResponseResult | null> {
    const epoch = deps.session.captureEpoch();
    dropNotificationTapIntentIfStale({
      epoch,
      isEpochCurrent: (e) => deps.session.isEpochCurrent(e),
    });

    const snap = deps.session.getSnapshot();
    if (snap.status === 'signed-out') {
      clearNotificationTapIntent();
      return null;
    }
    if (snap.status !== 'verified') return null;

    const resumed = resumeNotificationTapIntent({
      epoch,
      isEpochCurrent: (e) => deps.session.isEpochCurrent(e),
    });
    if (!resumed.ok) return null;

    const intent = resumed.intent;
    const resolved = await resolveNotificationRoute(
      {
        kind: intent.kind,
        ticketId: intent.ticketId,
        eventId: intent.eventId,
        tenantId: intent.tenantId,
        tenantSlug: intent.tenantSlug,
        eventSlug: intent.eventSlug,
      },
      resolveDeps,
    );

    if (!deps.session.isEpochCurrent(epoch)) {
      return { status: 'stale' };
    }

    if (resolved.status === 'routed') {
      markResponseConsumed(intent.responseId);
      deps.navigate(resolved.target.href);
      return {
        status: 'navigated',
        href: resolved.target.href,
        target: resolved.target,
      };
    }
    if (
      resolved.status === 'unauthorized' ||
      resolved.status === 'not-found' ||
      resolved.status === 'invalid'
    ) {
      markResponseConsumed(intent.responseId);
      return { status: 'denied', reason: resolved.status };
    }
    if (resolved.status === 'unsigned') {
      return { status: 'parked', kind: intent.kind };
    }
    if (resolved.status === 'epoch-stale') {
      return { status: 'stale' };
    }
    if (resolved.status === 'unreachable') {
      return { status: 'unreachable' };
    }
    if (resolved.status === 'misconfigured') {
      return { status: 'misconfigured' };
    }
    return { status: 'ignored', reason: resolved.status };
  }

  return {
    stop() {
      unsub();
      controller.stop();
    },
    onSessionChanged: onSessionChangedInternal,
  };
}

/** Re-export for screens/tests that park manually. */
export {
  clearNotificationTapIntent,
  peekNotificationTapIntent,
  handleNotificationResponse,
};
