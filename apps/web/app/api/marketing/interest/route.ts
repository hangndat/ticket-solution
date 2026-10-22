import { NextResponse } from 'next/server';
import { shouldSkipMarketingAnalytics } from '../../../../src/marketing/analytics/privacy-signals';
import { acceptMarketingLead } from '../../../../src/marketing/lead/accept-lead';
import type { MarketingLeadLocale } from '../../../../src/marketing/interest-schema';
import {
  validateInterest,
  type InterestPayload,
} from '../../../../src/marketing/interest-validate';

/** Recent submissions for tests only (durable store is source of truth). */
const recent: Array<{ payload: InterestPayload; at: string; lead_id: string }> =
  [];

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;
const hits = new Map<string, number[]>();

function clientKey(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'local'
  );
}

function localeFromRequest(request: Request): MarketingLeadLocale {
  const header = request.headers.get('x-vemoki-locale');
  if (header === 'en') return 'en';
  const referer = request.headers.get('referer') ?? '';
  if (referer.includes('/en')) return 'en';
  return 'vi';
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const prev = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (prev.length >= RATE_MAX) {
    hits.set(key, prev);
    return true;
  }
  prev.push(now);
  hits.set(key, prev);
  return false;
}

export async function POST(request: Request) {
  if (rateLimited(clientKey(request))) {
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

  const input =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const result = validateInterest(input);
  if (!result.ok) {
    if (result.honeypot) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { ok: false, code: 'VALIDATION', fields: result.fields },
      { status: 400 },
    );
  }

  const locale =
    result.value.locale ?? localeFromRequest(request);
  const payload = { ...result.value, locale };

  const idempotencyHeader =
    request.headers.get('idempotency-key')?.trim() ||
    request.headers.get('Idempotency-Key')?.trim();

  const accepted = await acceptMarketingLead(payload, {
    clientKey: clientKey(request),
    locale,
    idempotencyHeader,
    skipAnalytics: shouldSkipMarketingAnalytics(request.headers),
  });

  if (!accepted.ok) {
    return NextResponse.json(
      { ok: false, code: accepted.code },
      { status: 503 },
    );
  }

  recent.push({
    payload: accepted.record.payload,
    at: accepted.record.at,
    lead_id: accepted.record.lead_id,
  });
  if (recent.length > 50) recent.splice(0, recent.length - 50);

  return NextResponse.json({
    ok: true,
    lead_id: accepted.record.lead_id,
    qualified: accepted.record.qualified,
    duplicate: accepted.duplicate,
  });
}

/** Test/helper — not exposed as public list. */
export function __interestSubmissionsForTests() {
  return recent;
}
