export type FetchJsonResult = {
  status: number;
  json: unknown;
  timedOut: boolean;
  networkError: boolean;
};

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

/**
 * Fetch JSON without throwing on abort/network — callers must handle timedOut/networkError.
 * Outcome may be unknown when the request left the client; keep the same idempotency-key.
 */
export async function fetchJson(
  input: RequestInfo,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchJsonResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(input, {
      ...init,
      signal: controller.signal,
      credentials: 'same-origin',
      cache: 'no-store',
    });
    let json: unknown = null;
    const text = await response.text();
    if (text) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = { code: 'INVALID_UPSTREAM_JSON', message: text.slice(0, 400) };
      }
    }
    return { status: response.status, json, timedOut: false, networkError: false };
  } catch (error) {
    if (isAbortError(error)) {
      return { status: 0, json: null, timedOut: true, networkError: false };
    }
    return { status: 0, json: null, timedOut: false, networkError: true };
  } finally {
    clearTimeout(timer);
  }
}
