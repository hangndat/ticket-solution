import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  decideHostRouting,
  demoHref,
  isMarketingHost,
  isProductPath,
  loginHref,
  publicMarketingPathToInternal,
} from '../src/marketing/hosts';
import { localeSwitchHref } from '../src/marketing/links';

describe('marketing host helpers', () => {
  it('recognizes apex marketing hosts', () => {
    assert.equal(isMarketingHost('vemoki.com'), true);
    assert.equal(isMarketingHost('www.vemoki.com'), true);
    assert.equal(isMarketingHost('app.vemoki.com'), false);
    assert.equal(isMarketingHost('localhost'), false);
  });

  it('classifies product paths', () => {
    assert.equal(isProductPath('/auth'), true);
    assert.equal(isProductPath('/api/bff/me'), true);
    assert.equal(isProductPath('/t/sunburst/events/x'), true);
    assert.equal(isProductPath('/privacy'), false);
    assert.equal(isProductPath('/api/marketing/interest'), false);
  });

  it('maps public marketing paths', () => {
    assert.deepEqual(publicMarketingPathToInternal('/'), {
      internal: '/marketing',
      locale: 'vi',
    });
    assert.deepEqual(publicMarketingPathToInternal('/en'), {
      internal: '/marketing/en',
      locale: 'en',
    });
    assert.deepEqual(publicMarketingPathToInternal('/privacy'), {
      internal: '/marketing/privacy',
      locale: 'vi',
    });
  });

  it('locale switch preserves hash (PD F3)', () => {
    assert.equal(localeSwitchHref('en', 'sales', '#interest'), '/en#interest');
    assert.equal(localeSwitchHref('vi', 'sales', 'interest'), '/#interest');
    assert.equal(
      localeSwitchHref('en', 'privacy', '#top'),
      '/en/privacy#top',
    );
  });

  it('locale switch keeps viewers in the cinematic journey', () => {
    assert.equal(localeSwitchHref('en', 'journey'), '/en/experience');
    assert.equal(localeSwitchHref('vi', 'journey'), '/experience');
    assert.equal(
      decideHostRouting({ host: 'vemoki.com', pathname: '/en/experience' }).type,
      'next',
    );
  });

  it('CTA hrefs point at product origin', () => {
    assert.equal(
      demoHref('https://app.vemoki.com'),
      'https://app.vemoki.com/?demo=1',
    );
    assert.equal(
      loginHref('https://app.vemoki.com'),
      'https://app.vemoki.com/auth',
    );
  });
});

describe('decideHostRouting', () => {
  const base = {
    productOrigin: 'https://app.vemoki.com',
    marketingOrigin: 'https://vemoki.com',
    marketingHosts: ['vemoki.com', 'www.vemoki.com'],
  };

  it('keeps localhost / as product (next)', () => {
    const d = decideHostRouting({ ...base, host: 'localhost:3000', pathname: '/' });
    assert.equal(d.type, 'next');
  });

  it('rewrites apex / to marketing sales', () => {
    const d = decideHostRouting({ ...base, host: 'vemoki.com', pathname: '/' });
    assert.deepEqual(d, {
      type: 'rewrite',
      pathname: '/marketing',
      locale: 'vi',
      surface: 'marketing',
    });
  });

  it('redirects product path on apex to app origin', () => {
    const d = decideHostRouting({
      ...base,
      host: 'vemoki.com',
      pathname: '/auth',
      search: '?next=/admin',
    });
    assert.deepEqual(d, {
      type: 'redirect',
      location: 'https://app.vemoki.com/auth?next=/admin',
      status: 302,
    });
  });

  it('redirects apex /admin and /gate to product origin (before soft-redirect)', () => {
    for (const pathname of ['/admin', '/gate'] as const) {
      const d = decideHostRouting({
        ...base,
        host: 'vemoki.com',
        pathname,
      });
      assert.deepEqual(d, {
        type: 'redirect',
        location: `https://app.vemoki.com${pathname}`,
        status: 302,
      });
    }
  });

  it('301 www to apex marketing origin', () => {
    const d = decideHostRouting({
      ...base,
      host: 'www.vemoki.com',
      pathname: '/en',
      search: '',
    });
    assert.deepEqual(d, {
      type: 'redirect',
      location: 'https://vemoki.com/en',
      status: 301,
    });
  });

  it('serves /privacy on product host (app router)', () => {
    const d = decideHostRouting({
      ...base,
      host: '127.0.0.1:3000',
      pathname: '/privacy',
    });
    assert.deepEqual(d, { type: 'next' });
  });

  it('rewrites /privacy on marketing apex', () => {
    const d = decideHostRouting({
      ...base,
      host: 'vemoki.com',
      pathname: '/privacy',
    });
    assert.deepEqual(d, {
      type: 'rewrite',
      pathname: '/marketing/privacy',
      locale: 'vi',
      surface: 'marketing',
    });
  });

  it('rewrites /en sales on product host', () => {
    const d = decideHostRouting({
      ...base,
      host: 'app.vemoki.com',
      pathname: '/en',
    });
    assert.deepEqual(d, {
      type: 'rewrite',
      pathname: '/marketing/en',
      locale: 'en',
      surface: 'marketing',
    });
  });

  it('does not self-rewrite already-internal /marketing paths', () => {
    const sales = decideHostRouting({
      ...base,
      host: 'localhost:3000',
      pathname: '/marketing',
    });
    assert.deepEqual(sales, {
      type: 'next',
      surface: 'marketing',
      locale: 'vi',
    });
    const privacy = decideHostRouting({
      ...base,
      host: 'vemoki.com',
      pathname: '/marketing/privacy',
    });
    assert.deepEqual(privacy, {
      type: 'next',
      surface: 'marketing',
      locale: 'vi',
    });
    const en = decideHostRouting({
      ...base,
      host: '127.0.0.1:3000',
      pathname: '/marketing/en',
    });
    assert.deepEqual(en, {
      type: 'next',
      surface: 'marketing',
      locale: 'en',
    });
  });
});
