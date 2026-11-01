import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { POST } from '../app/api/marketing/events/route';
import { MARKETING_ANALYTICS_CLIENT_EVENTS } from '../src/marketing/analytics/events';
import {
  __resetAnalyticsRateLimitForTests,
  clientKeyFromRequest,
  isAnalyticsRateLimited,
} from '../src/marketing/analytics/rate-limit';
import {
  allowedMarketingOrigins,
  checkMarketingAnalyticsRequest,
} from '../src/marketing/analytics/request-guard';
import { shouldSkipMarketingAnalytics } from '../src/marketing/analytics/privacy-signals';
import { validateMarketingAnalyticsBody } from '../src/marketing/analytics/validate';
import { trustedClientIpForRateLimit } from '../src/security/trusted-client-ip';

function analyticsRequest(
  init: RequestInit & { url?: string } = {},
): Request {
  const url = init.url ?? 'http://127.0.0.1/api/marketing/events';
  const headers = new Headers(init.headers);
  if (!headers.has('origin')) headers.set('origin', 'http://127.0.0.1');
  if (!headers.has('host')) headers.set('host', '127.0.0.1');
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  return new Request(url, { method: 'POST', ...init, headers });
}

describe('marketing analytics validate', () => {
  it('allowlists known events only', () => {
    for (const event of MARKETING_ANALYTICS_CLIENT_EVENTS) {
      const props =
        event === 'cta_click'
          ? { cta_id: 'cta-demo', locale: 'vi' }
          : event === 'journey_progress'
            ? { milestone: 'invitation', locale: 'vi' }
            : { locale: 'vi' };
      const r = validateMarketingAnalyticsBody({ event, props });
      assert.equal(r.ok, true);
    }
    const serverOnly = validateMarketingAnalyticsBody({
      event: 'qualified_lead',
      props: { locale: 'vi', role: 'owner' },
    });
    assert.equal(serverOnly.ok, false);
    const bad = validateMarketingAnalyticsBody({ event: 'page_view', props: {} });
    assert.equal(bad.ok, false);
  });

  it('rejects PII in prop keys', () => {
    const r = validateMarketingAnalyticsBody({
      event: 'cta_click',
      props: { email: 'a@b.com', cta_id: 'cta-demo', locale: 'vi' },
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, 'PII');
  });

  it('rejects email-like values in free props', () => {
    const r = validateMarketingAnalyticsBody({
      event: 'cta_click',
      props: { cta_id: 'cta-demo', locale: 'vi', foo: 'a@b.com' },
    });
    assert.equal(r.ok, false);
  });

  it('rejects phone and URL patterns in values', () => {
    for (const value of ['0901234567', 'https://evil.test', 'www.evil.test']) {
      const r = validateMarketingAnalyticsBody({
        event: 'form_start',
        props: { locale: 'vi', extra: value },
      });
      assert.equal(r.ok, false);
    }
  });

  it('rejects unknown cta_id and extra keys', () => {
    const r = validateMarketingAnalyticsBody({
      event: 'cta_click',
      props: { cta_id: 'cta-hack', locale: 'vi' },
    });
    assert.equal(r.ok, false);
    const long = 'x'.repeat(65);
    const r2 = validateMarketingAnalyticsBody({
      event: 'form_start',
      props: { locale: long },
    });
    assert.equal(r2.ok, false);
  });

  it('respects DNT and GPC on server', () => {
    assert.equal(
      shouldSkipMarketingAnalytics(new Headers({ dnt: '1' })),
      true,
    );
    assert.equal(
      shouldSkipMarketingAnalytics(new Headers({ 'sec-gpc': '1' })),
      true,
    );
  });
});

describe('marketing analytics request guard', () => {
  it('allows configured marketing origins', () => {
    const origins = allowedMarketingOrigins({ NODE_ENV: 'test' });
    assert.ok(origins.some((o) => o.includes('vemoki.com')));
    assert.equal(
      checkMarketingAnalyticsRequest(
        analyticsRequest({
          url: 'https://vemoki.com/api/marketing/events',
          headers: {
            origin: 'https://vemoki.com',
            host: 'vemoki.com',
          },
        }),
        { NODE_ENV: 'production', MARKETING_ORIGIN: 'https://vemoki.com' },
      ),
      null,
    );
  });

  it('rejects missing or evil Origin', () => {
    const noOrigin = new Request('https://vemoki.com/api/marketing/events', {
      method: 'POST',
      headers: { host: 'vemoki.com', 'content-type': 'application/json' },
    });
    assert.equal(
      checkMarketingAnalyticsRequest(noOrigin, {
        NODE_ENV: 'production',
        MARKETING_ORIGIN: 'https://vemoki.com',
      })?.code,
      'FORBIDDEN_ORIGIN',
    );
    const evil = analyticsRequest({
      url: 'https://vemoki.com/api/marketing/events',
      headers: {
        origin: 'https://evil.example',
        host: 'vemoki.com',
      },
    });
    assert.equal(
      checkMarketingAnalyticsRequest(evil, {
        NODE_ENV: 'production',
        MARKETING_ORIGIN: 'https://vemoki.com',
      })?.code,
      'FORBIDDEN_ORIGIN',
    );
  });

  it('rejects product Host despite forged marketing forwarded host and allowed Origin', () => {
    const env = { NODE_ENV: 'production', MARKETING_ORIGIN: 'https://vemoki.com' };
    const request = analyticsRequest({
      url: 'https://app.vemoki.com/api/marketing/events',
      headers: {
        host: 'app.vemoki.com',
        'x-forwarded-host': 'vemoki.com',
        origin: 'https://vemoki.com',
      },
    });
    assert.deepEqual(checkMarketingAnalyticsRequest(request, env), {
      code: 'FORBIDDEN_HOST',
      status: 403,
    });
  });

  it('accepts marketing Host despite forged product forwarded host', () => {
    const request = analyticsRequest({
      url: 'https://vemoki.com/api/marketing/events',
      headers: {
        host: 'vemoki.com',
        'x-forwarded-host': 'app.vemoki.com',
        origin: 'https://vemoki.com',
      },
    });
    assert.equal(
      checkMarketingAnalyticsRequest(request, {
        NODE_ENV: 'production',
        MARKETING_ORIGIN: 'https://vemoki.com',
      }),
      null,
    );
  });
});

describe('trusted client IP for rate limit', () => {
  it('ignores spoofed X-Forwarded-For when TRUST_PROXY is off', () => {
    const a = trustedClientIpForRateLimit(
      new Request('http://127.0.0.1', {
        headers: { 'x-forwarded-for': '203.0.113.1' },
      }),
      { TRUST_PROXY: 'false' },
    );
    const b = trustedClientIpForRateLimit(
      new Request('http://127.0.0.1', {
        headers: { 'x-forwarded-for': '203.0.113.99' },
      }),
      { TRUST_PROXY: 'false' },
    );
    assert.equal(a, b);
    assert.equal(a, 'untrusted');
  });

  it('uses X-Real-IP when TRUST_PROXY is on', () => {
    const ip = trustedClientIpForRateLimit(
      new Request('http://127.0.0.1', {
        headers: {
          'x-forwarded-for': '203.0.113.1, 198.51.100.2',
          'x-real-ip': '198.51.100.2',
        },
      }),
      { TRUST_PROXY: 'true' },
    );
    assert.equal(ip, '198.51.100.2');
  });
});

describe('marketing analytics route', () => {
  it('accepts allowlisted event with valid origin', async () => {
    __resetAnalyticsRateLimitForTests();
    const res = await POST(
      analyticsRequest({
        body: JSON.stringify({
          event: 'cta_click',
          props: { cta_id: 'cta-demo', locale: 'vi' },
        }),
      }),
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
  });

  it('accepts sendBeacon-style application/json body', async () => {
    __resetAnalyticsRateLimitForTests();
    const res = await POST(
      analyticsRequest({
        body: JSON.stringify({
          event: 'form_start',
          props: { locale: 'en' },
        }),
      }),
    );
    assert.equal(res.status, 200);
  });

  it('rejects evil origin with 403', async () => {
    const res = await POST(
      analyticsRequest({
        headers: { origin: 'https://evil.example' },
        body: JSON.stringify({
          event: 'cta_click',
          props: { cta_id: 'cta-demo', locale: 'vi' },
        }),
      }),
    );
    assert.equal(res.status, 403);
  });

  it('rejects PII payload on route', async () => {
    const res = await POST(
      analyticsRequest({
        body: JSON.stringify({
          event: 'cta_click',
          props: { cta_id: 'cta-demo', locale: 'vi', note: 'call 0901234567' },
        }),
      }),
    );
    assert.equal(res.status, 400);
  });

  it('rate limits burst traffic on stable client key', async () => {
    __resetAnalyticsRateLimitForTests();
    const key = clientKeyFromRequest(
      new Request('http://127.0.0.1', {
        headers: { 'x-forwarded-for': '203.0.113.9' },
      }),
    );
    let limited = false;
    for (let i = 0; i < 65; i++) {
      if (isAnalyticsRateLimited(key)) {
        limited = true;
        break;
      }
    }
    assert.ok(limited);
  });

  it('skips when DNT is set', async () => {
    const res = await POST(
      analyticsRequest({
        headers: { dnt: '1' },
        body: JSON.stringify({ event: 'form_start', props: { locale: 'vi' } }),
      }),
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).skipped, 'privacy');
  });
});
