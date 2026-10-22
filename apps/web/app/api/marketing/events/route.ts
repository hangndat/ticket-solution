import { NextResponse } from 'next/server';
import { shouldSkipMarketingAnalytics } from '../../../../src/marketing/analytics/privacy-signals';
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

  const key = clientKeyFromRequest(request);
  if (isAnalyticsRateLimited(key)) {
    return NextResponse.json(
      { ok: false, code: 'RATE_LIMITED' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
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
