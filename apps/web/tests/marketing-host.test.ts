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

  it('rewrites /privacy on any host', () => {
    const d = decideHostRouting({
      ...base,
      host: '127.0.0.1:3000',
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
});
