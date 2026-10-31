import { NextResponse } from 'next/server';
import { ensureCsrfCookie } from '../../../../src/bff/csrf';

/** Public bootstrap for the same-origin browser's double-submit cookie. */
export async function GET() {
  await ensureCsrfCookie();
  return NextResponse.json(
    { ready: true },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
