import { NextResponse } from 'next/server';
import { persistInterestSubmission } from '../../../../src/marketing/interest-store';
import {
  validateInterest,
  type InterestPayload,
} from '../../../../src/marketing/interest-validate';

/** Recent submissions for tests only (durable store is source of truth). */
const recent: Array<InterestPayload & { at: string }> = [];

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

  try {
    const record = await persistInterestSubmission(result.value, {
      clientKey: clientKey(request),
    });
    recent.push({ ...result.value, at: record.at });
    if (recent.length > 50) recent.splice(0, recent.length - 50);
  } catch (err) {
    console.error('[marketing-interest] persist failed', err);
    return NextResponse.json(
      { ok: false, code: 'STORE_FAILED' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}

/** Test/helper — not exposed as public list. */
export function __interestSubmissionsForTests() {
  return recent;
}
