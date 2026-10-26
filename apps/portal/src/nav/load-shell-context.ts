'use client';

import type {
  MeEventsResponse,
  MeTenantsResponse,
  PlatformMeResponse,
} from '@ticket/contracts';
import type { MessageKey } from '../i18n/messages';
import {
  parseMeEventsResponse,
  parseMeTenantsResponse,
  parsePlatformMeResponse,
} from '../discovery/me';
import {
  derivePortalShellCapabilities,
  type PortalShellCapabilities,
} from './capabilities';
import { publishPortalShellSnapshot } from './portal-shell-snapshot';

const REQUEST_TIMEOUT_MS = 8_000;

export type ShellLoadState =
  | { status: 'loading' }
  | {
      status: 'ready';
      caps: PortalShellCapabilities;
      meTenants: MeTenantsResponse | null;
      meEvents: MeEventsResponse | null;
      platformMe: PlatformMeResponse | null;
      http: { tenants: number; events: number; platform: number };
    }
  /** UI translates `messageKey` so locale switch does not need a reload. */
  | { status: 'error'; messageKey: MessageKey }
  | { status: 'unauthenticated' };

async function getJson(
  path: string,
): Promise<{ status: number; json: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Client discovery for portal shell — deny-by-default until server payloads parse.
 * Platform me uses a separate cookie; 401 there does not imply staff signed out.
 */
let shellContextInflight: Promise<ShellLoadState> | null = null;

export type DiscoveryHttpResult = { status: number; json: unknown };

/** Pure resolver for shell discovery — unit-tested (#850 F04). */
export function resolveShellLoadState(input: {
  tenantsResult: DiscoveryHttpResult;
  eventsResult: DiscoveryHttpResult;
  platformResult: DiscoveryHttpResult;
}): ShellLoadState {
  const { tenantsResult, eventsResult, platformResult } = input;

  if (
    tenantsResult.status === 401 &&
    eventsResult.status === 401 &&
    platformResult.status === 401
  ) {
    return { status: 'unauthenticated' };
  }

  const meTenants = parseMeTenantsResponse(
    tenantsResult.status,
    tenantsResult.json,
  );
  const meEvents = parseMeEventsResponse(
    eventsResult.status,
    eventsResult.json,
  );
  const platformMe = parsePlatformMeResponse(
    platformResult.status,
    platformResult.json,
  );

  const authenticated =
    meTenants !== null || meEvents !== null || platformMe !== null;

  if (!authenticated) {
    if (
      tenantsResult.status >= 500 ||
      eventsResult.status >= 500 ||
      (tenantsResult.status === 0 && eventsResult.status === 0)
    ) {
      return {
        status: 'error',
        messageKey: 'shell.load.serverUnreachable',
      };
    }
    return { status: 'unauthenticated' };
  }

  const caps = derivePortalShellCapabilities({
    authenticated: true,
    meEvents,
    meTenants,
    platformMe,
  });

  return {
    status: 'ready',
    caps,
    meTenants,
    meEvents,
    platformMe,
    http: {
      tenants: tenantsResult.status,
      events: eventsResult.status,
      platform: platformResult.status,
    },
  };
}

async function loadShellContextOnce(): Promise<ShellLoadState> {
  try {
    const [tenantsResult, eventsResult, platformResult] = await Promise.all([
      getJson('/api/bff/me/tenants'),
      getJson('/api/bff/me/events'),
      getJson('/api/bff/platform/me'),
    ]);
    return resolveShellLoadState({
      tenantsResult,
      eventsResult,
      platformResult,
    });
  } catch {
    return {
      status: 'error',
      messageKey: 'shell.load.unknownConnection',
    };
  }
}

function trackShellLoad(promise: Promise<ShellLoadState>): Promise<ShellLoadState> {
  return promise.then((result) => {
    publishPortalShellSnapshot(result);
    return result;
  });
}

/** Dedupe parallel discovery calls (shell + route guards share one flight). */
export function loadShellContext(): Promise<ShellLoadState> {
  if (!shellContextInflight) {
    shellContextInflight = trackShellLoad(loadShellContextOnce()).finally(() => {
      shellContextInflight = null;
    });
  }
  return shellContextInflight;
}

/** Force a new discovery round (e.g. after create/clone when MeEvents was stale). */
export function refreshShellContext(): Promise<ShellLoadState> {
  shellContextInflight = null;
  return loadShellContext();
}
