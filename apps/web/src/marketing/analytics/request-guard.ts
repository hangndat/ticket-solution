import { canonicalizeOrigin } from '@ticket/web-session';
import {
  isMarketingHost,
  marketingHostsFromEnv,
  marketingOriginFromEnv,
  normalizeHost,
  trustedRequestHost,
} from '../hosts';

export const MAX_ANALYTICS_BODY_BYTES = 4096;

export type MarketingRequestViolation = {
  code:
    | 'FORBIDDEN_ORIGIN'
    | 'FORBIDDEN_HOST'
    | 'INVALID_CONTENT_TYPE'
    | 'BODY_TOO_LARGE';
  status: 403 | 413 | 415;
};

type GuardEnv = Readonly<Record<string, string | undefined>>;

function hostsEnv(env: GuardEnv): NodeJS.ProcessEnv {
  return env as NodeJS.ProcessEnv;
}

export function allowedMarketingOrigins(env: GuardEnv = process.env): string[] {
  const origins = new Set<string>();
  const primary = canonicalizeOrigin(marketingOriginFromEnv(hostsEnv(env)));
  if (primary) origins.add(primary);

  for (const host of marketingHostsFromEnv(hostsEnv(env))) {
    for (const scheme of env.NODE_ENV === 'production' ? ['https'] : ['https', 'http']) {
      const o = canonicalizeOrigin(`${scheme}://${host}`);
      if (o) origins.add(o);
    }
  }

  if (env.NODE_ENV !== 'production') {
    for (const host of ['localhost', '127.0.0.1']) {
      for (const port of ['', ':3000', ':3010']) {
        const o = canonicalizeOrigin(`http://${host}${port}`);
        if (o) origins.add(o);
      }
    }
  }

  return [...origins];
}

/** Origin + Host guard for first-party marketing analytics (no Referer). */
export function checkMarketingAnalyticsRequest(
  request: Request,
  env: GuardEnv = process.env,
): MarketingRequestViolation | null {
  const host = normalizeHost(trustedRequestHost(request.headers));
  const hosts = marketingHostsFromEnv(hostsEnv(env));
  const hostOk =
    isMarketingHost(host, hosts) ||
    (env.NODE_ENV !== 'production' &&
      (host === 'localhost' || host === '127.0.0.1'));
  if (!hostOk) {
    return { code: 'FORBIDDEN_HOST', status: 403 };
  }

  const originRaw = request.headers.get('origin');
  if (!originRaw) {
    return { code: 'FORBIDDEN_ORIGIN', status: 403 };
  }
  const origin = canonicalizeOrigin(originRaw);
  if (!origin || !allowedMarketingOrigins(env).includes(origin)) {
    return { code: 'FORBIDDEN_ORIGIN', status: 403 };
  }

  const contentType = request.headers
    .get('content-type')
    ?.split(';')[0]
    ?.trim()
    .toLowerCase();
  if (contentType && contentType !== 'application/json') {
    return { code: 'INVALID_CONTENT_TYPE', status: 415 };
  }

  return null;
}
