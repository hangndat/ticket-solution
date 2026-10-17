/**
 * Staff Gate connectivity (D7-S3 / #113).
 * Browser online ≠ API reachable. Degraded covers timeout / network / 5xx.
 * Web Gate does not queue CHECKIN_OFFLINE — that is iOS (ADR-18 / #105).
 */

export type GateLinkState = 'online' | 'offline' | 'degraded';

export type GateConnectivity = {
  /** navigator.onLine (browser link). */
  browserOnline: boolean;
  /** Last probe or request: API considered unreachable. */
  apiUnreachable: boolean;
  link: GateLinkState;
};

export function resolveGateLinkState(input: {
  browserOnline: boolean;
  apiUnreachable: boolean;
}): GateLinkState {
  if (!input.browserOnline) return 'offline';
  if (input.apiUnreachable) return 'degraded';
  return 'online';
}

export function isApiUnreachableResult(result: {
  timedOut: boolean;
  networkError: boolean;
  status: number;
}): boolean {
  return (
    result.timedOut ||
    result.networkError ||
    result.status === 0 ||
    result.status >= 500
  );
}

export function readBrowserOnline(
  nav?: Pick<Navigator, 'onLine'> | null,
): boolean {
  const source =
    nav ??
    (typeof globalThis !== 'undefined' && 'navigator' in globalThis
      ? (globalThis as { navigator?: Pick<Navigator, 'onLine'> }).navigator
      : undefined);
  if (!source || typeof source.onLine !== 'boolean') return true;
  return source.onLine;
}
