/** Sensitive BFF payloads must not be stored, even if upstream sends a cacheable header. */
export function withPrivateNoStore(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(res.body, { status: res.status, headers });
}
