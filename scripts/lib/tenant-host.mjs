/**
 * Canonical tenant host mapping + public cache key + host-only cookie rules.
 * Root shared helper (R-INT). Consumers (web BFF / edge) may mirror or import;
 * do not trust raw Host / X-Forwarded-Host without allowlist.
 *
 * No secrets. No production DNS changes here.
 */

/** @typedef {{ tenantSlug: string, canonicalHost: string }} TenantHostBinding */

/**
 * @param {string} rootDomain e.g. vemoki.com
 * @returns {RegExp}
 */
export function tenantSubdomainPattern(rootDomain) {
  const escaped = rootDomain.replace(/\./g, '\\.');
  return new RegExp(`^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\\.${escaped}$`, 'i');
}

/**
 * Build allowlisted map: host → tenantSlug.
 * Only `{slug}.{rootDomain}` and optional explicit overrides.
 *
 * @param {{
 *   rootDomain: string,
 *   tenantSlugs: string[],
 *   extraBindings?: TenantHostBinding[],
 * }} opts
 * @returns {Map<string, string>}
 */
export function buildTenantHostAllowlist(opts) {
  const root = opts.rootDomain.trim().toLowerCase();
  const map = new Map();
  for (const slug of opts.tenantSlugs) {
    const s = slug.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s)) {
      throw new Error(`invalid tenant slug: ${slug}`);
    }
    map.set(`${s}.${root}`, s);
  }
  for (const b of opts.extraBindings ?? []) {
    const host = b.canonicalHost.trim().toLowerCase();
    const slug = b.tenantSlug.trim().toLowerCase();
    map.set(host, slug);
  }
  return map;
}

/**
 * Resolve Host header to tenant. Rejects apex, unknown hosts, spoofed values.
 *
 * @param {string} hostHeader
 * @param {Map<string, string>} allowlist
 * @param {{ rootDomain: string }} opts
 * @returns {{ ok: true, tenantSlug: string, canonicalHost: string } | { ok: false, reason: string }}
 */
export function resolveTenantHost(hostHeader, allowlist, opts) {
  const raw = (hostHeader ?? '').trim().toLowerCase();
  if (!raw) return { ok: false, reason: 'empty_host' };
  // Strip port for local/dev
  const host = raw.replace(/:\d+$/, '');
  if (host === opts.rootDomain.toLowerCase() || host === `www.${opts.rootDomain.toLowerCase()}`) {
    return { ok: false, reason: 'platform_apex_not_tenant' };
  }
  if (host.includes('..') || host.startsWith('.') || host.endsWith('.')) {
    return { ok: false, reason: 'malformed_host' };
  }
  const slug = allowlist.get(host);
  if (!slug) return { ok: false, reason: 'host_not_allowlisted' };
  return { ok: true, tenantSlug: slug, canonicalHost: host };
}

/**
 * Public content cache key (TD §12.1). Never includes cookies or auth.
 *
 * @param {{
 *   canonicalHost: string,
 *   tenantSlug: string,
 *   eventSlug: string,
 *   publishedVersion: number | string,
 *   schemaVersion: number | string,
 *   locale: string,
 * }} p
 */
export function publicContentCacheKey(p) {
  return [
    'pub',
    p.canonicalHost.toLowerCase(),
    p.tenantSlug.toLowerCase(),
    p.eventSlug.toLowerCase(),
    String(p.publishedVersion),
    String(p.schemaVersion),
    p.locale.toLowerCase(),
  ].join('|');
}

/**
 * Session cookie attributes: host-only (omit Domain), path=/, SameSite=Lax.
 * Setting Domain=`.${root}` would share across tenant subdomains — forbidden (O07/TD).
 *
 * @param {{ secure?: boolean, maxAgeSeconds?: number }} [opts]
 */
export function hostOnlySessionCookieOptions(opts = {}) {
  return {
    httpOnly: true,
    secure: opts.secure === true,
    sameSite: 'lax',
    path: '/',
    maxAge: opts.maxAgeSeconds ?? 3600,
    // Explicitly no `domain` key → host-only
  };
}

/**
 * @param {Record<string, unknown>} cookieOpts
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function assertHostOnlyCookie(cookieOpts) {
  if (Object.prototype.hasOwnProperty.call(cookieOpts, 'domain') && cookieOpts.domain != null) {
    return { ok: false, reason: 'domain_attribute_forbidden' };
  }
  if (cookieOpts.sameSite !== 'lax' && cookieOpts.sameSite !== 'strict') {
    return { ok: false, reason: 'samesite_required' };
  }
  if (cookieOpts.path !== '/') {
    return { ok: false, reason: 'path_must_be_root' };
  }
  return { ok: true };
}

/**
 * Path pair isolation: event path under tenant A must not resolve under tenant B.
 *
 * @param {string} pathTenantSlug
 * @param {string} hostTenantSlug
 */
export function assertPathTenantMatchesHost(pathTenantSlug, hostTenantSlug) {
  const a = pathTenantSlug.trim().toLowerCase();
  const b = hostTenantSlug.trim().toLowerCase();
  if (a !== b) {
    return { ok: false, reason: 'path_host_tenant_mismatch' };
  }
  return { ok: true };
}
