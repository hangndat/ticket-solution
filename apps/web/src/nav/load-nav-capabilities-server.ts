import 'server-only';

import { PLATFORM_PATHS } from '../bff/platform-contracts';
import { ssrUpstreamGet } from '../bff/upstream';
import { resolveNavCapabilitiesFromUpstream } from './resolve-nav-capabilities';

const REQUEST_TIMEOUT_MS = 8_000;

/** SSR nav discovery for consumer layout — same contract as client O02 loader. */
export async function loadNavCapabilitiesServer() {
  const [eventsResult, tenantsResult] = await Promise.all([
    ssrUpstreamGet(PLATFORM_PATHS.meEvents, {
      timeoutMs: REQUEST_TIMEOUT_MS,
    }),
    ssrUpstreamGet(PLATFORM_PATHS.meTenants, {
      timeoutMs: REQUEST_TIMEOUT_MS,
    }),
  ]);

  return resolveNavCapabilitiesFromUpstream(eventsResult, tenantsResult);
}
