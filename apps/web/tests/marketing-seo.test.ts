import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { salesMetadata } from '../src/marketing/seo/metadata';
import { trustedRequestHost } from '../src/marketing/hosts';
import {
  marketingDisallowPaths,
  marketingSitemapEntries,
  resolveRobotsPolicy,
  resolveSitemapEntries,
  robotsForProductHost,
} from '../src/marketing/seo/robots-sitemap';

describe('marketing SEO robots/sitemap', () => {
  it('disallows product paths without enumerating private app routes', () => {
    const dis = marketingDisallowPaths();
    assert.ok(!dis.includes('/admin'));
    assert.ok(!dis.includes('/gate'));
    assert.ok(!dis.includes('/wallet'));
    assert.ok(dis.some((p) => p.startsWith('/t')));
    assert.ok(dis.includes('/auth'));
  });

  it('marketing robots includes sitemap on apex', () => {
    const policy = resolveRobotsPolicy('vemoki.com');
    assert.ok(policy.sitemap?.includes('https://vemoki.com/sitemap.xml'));
    assert.equal(policy.rules[0]?.allow, '/');
  });

  it('product host robots disallow all', () => {
    const policy = robotsForProductHost();
    assert.deepEqual(policy.rules[0]?.disallow, '/');
    assert.equal(resolveSitemapEntries('app.vemoki.com').length, 0);
  });

  it('uses product policy when a direct upstream request for app forges marketing forwarded host', () => {
    const host = trustedRequestHost(new Headers({
      host: 'app.vemoki.com',
      'x-forwarded-host': 'vemoki.com',
    }));
    assert.equal(resolveRobotsPolicy(host).rules[0]?.disallow, '/');
    assert.equal(resolveRobotsPolicy(host).sitemap, undefined);
    assert.deepEqual(resolveSitemapEntries(host), []);
  });

  it('keeps marketing policy when forwarded host claims product, and fails closed without Host', () => {
    const marketingHost = trustedRequestHost(new Headers({
      host: 'vemoki.com',
      'x-forwarded-host': 'app.vemoki.com',
    }));
    assert.equal(resolveRobotsPolicy(marketingHost).rules[0]?.allow, '/');
    assert.ok(resolveSitemapEntries(marketingHost).length > 0);

    const missingHost = trustedRequestHost(new Headers({
      'x-forwarded-host': 'vemoki.com',
    }));
    assert.equal(resolveRobotsPolicy(missingHost).rules[0]?.disallow, '/');
    assert.deepEqual(resolveSitemapEntries(missingHost), []);
  });

  it('sitemap lists public VI/EN marketing URLs only', () => {
    const entries = marketingSitemapEntries('https://vemoki.com');
    const urls = entries.map((e) => e.url);
    assert.ok(urls.includes('https://vemoki.com/'));
    assert.ok(urls.includes('https://vemoki.com/en'));
    assert.ok(urls.includes('https://vemoki.com/privacy'));
    assert.ok(urls.includes('https://vemoki.com/en/support'));
    assert.ok(!urls.some((u) => u.includes('/admin')));
    assert.ok(!urls.some((u) => u.includes('/wallet')));
    assert.ok(!urls.some((u) => u.includes('/marketing')));
  });

  it('sales metadata uses marketing origin for OG image', () => {
    const prev = process.env.MARKETING_ORIGIN;
    process.env.MARKETING_ORIGIN = 'https://vemoki.com';
    const meta = salesMetadata('vi');
    const og = meta.openGraph?.images;
    const first = Array.isArray(og) ? og[0] : og;
    const url =
      typeof first === 'string'
        ? first
        : first && typeof first === 'object' && 'url' in first
          ? String(first.url)
          : '';
    assert.ok(url.includes('vemoki.com/opengraph-image'));
    assert.ok(!url.includes('app.vemoki.com'));
    const canon = meta.alternates?.canonical;
    assert.ok(
      canon === 'https://vemoki.com/' || canon?.toString().includes('vemoki.com'),
    );
    if (prev !== undefined) process.env.MARKETING_ORIGIN = prev;
    else delete process.env.MARKETING_ORIGIN;
  });
});
