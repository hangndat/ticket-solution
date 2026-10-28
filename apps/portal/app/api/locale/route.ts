import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  portalLocaleCookieOptions,
  portalLocaleFromJsonBody,
} from '../../../src/i18n/locale-cookie';
import { PORTAL_LOCALE_STORAGE_KEY } from '../../../src/i18n/storage';

/**
 * Persist staff UI locale so RootLayout `cookies()` can set `<html lang>`
 * after `router.refresh()`. Client `document.cookie` alone does not update
 * the Next request cookie jar used for SSR lang.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const locale = portalLocaleFromJsonBody(body);
  const jar = await cookies();
  const secure =
    request.headers.get('x-forwarded-proto') === 'https' ||
    new URL(request.url).protocol === 'https:';
  jar.set(
    PORTAL_LOCALE_STORAGE_KEY,
    locale,
    portalLocaleCookieOptions(secure),
  );
  return NextResponse.json({ locale });
}
