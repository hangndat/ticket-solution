import { NextResponse } from 'next/server';
import { shouldSkipMarketingAnalytics } from '../../../../src/marketing/analytics/privacy-signals';
import {
  checkMarketingAnalyticsRequest,
  MAX_ANALYTICS_BODY_BYTES,
} from '../../../../src/marketing/analytics/request-guard';
import {
  clientKeyFromRequest,
  isAnalyticsRateLimited,
} from '../../../../src/marketing/analytics/rate-limit';
import {
  defaultServerAdapter,
  setMarketingAnalyticsAdapter,
  trackMarketingEvent,
} from '../../../../src/marketing/analytics/track';
import { validateMarketingAnalyticsBody } from '../../../../src/marketing/analytics/validate';

setMarketingAnalyticsAdapter(defaultServerAdapter());

const recent: Array<{ event: string; props: Record<string, unknown>; at: string }> =
  [];

export async function POST(request: Request) {
  if (shouldSkipMarketingAnalytics(request.headers)) {
    return NextResponse.json({ ok: true, skipped: 'privacy' });
  }

  const guard = checkMarketingAnalyticsRequest(request);
  if (guard) {
    return NextResponse.json(
      { ok: false, code: guard.code },
      { status: guard.status },
    );
  }

  const key = clientKeyFromRequest(request);
  if (isAnalyticsRateLimited(key)) {
    return NextResponse.json(
      { ok: false, code: 'RATE_LIMITED' },
      { status: 429 },
    );
  }

  const rawBody = await request.arrayBuffer();
  if (rawBody.byteLength > MAX_ANALYTICS_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, code: 'BODY_TOO_LARGE' },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    const text = new TextDecoder().decode(rawBody);
    body = text ? JSON.parse(text) : null;
  } catch {
    return NextResponse.json(
      { ok: false, code: 'INVALID_JSON' },
      { status: 400 },
    );
  }

  const result = validateMarketingAnalyticsBody(body);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code },
      { status: 400 },
    );
  }

  trackMarketingEvent(result.event, result.props);
  recent.push({
    event: result.event,
    props: result.props,
    at: new Date().toISOString(),
  });
  if (recent.length > 100) recent.splice(0, recent.length - 100);

  return NextResponse.json({ ok: true });
}

export function __marketingEventsForTests() {
  return recent;
}
