export type FetchJsonResult = {
  status: number;
  json: unknown;
  timedOut: boolean;
  networkError: boolean;
};

export type FetchJsonResultObserver = (
  result: FetchJsonResult,
  requestUrl: string,
) => void;

const resultObservers = new Set<FetchJsonResultObserver>();

/**
 * Subscribe to every fetchJson outcome (browser clients).
 * Used by SEC-CACHE to clear SiteNav when BFF returns MEMBERSHIP_* 401/403.
 */
export function subscribeFetchJsonResult(
  observer: FetchJsonResultObserver,
): () => void {
  resultObservers.add(observer);
  return () => {
    resultObservers.delete(observer);
  };
}

function requestUrlOf(input: RequestInfo): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function publishResult(result: FetchJsonResult, requestUrl: string): void {
  for (const observer of resultObservers) {
    try {
      observer(result, requestUrl);
    } catch {
      // Observers must not break callers.
    }
  }
}

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
  const requestUrl = requestUrlOf(input);
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
    const result: FetchJsonResult = {
      status: response.status,
      json,
      timedOut: false,
      networkError: false,
    };
    publishResult(result, requestUrl);
    return result;
  } catch (error) {
    const result: FetchJsonResult = isAbortError(error)
      ? { status: 0, json: null, timedOut: true, networkError: false }
      : { status: 0, json: null, timedOut: false, networkError: true };
    publishResult(result, requestUrl);
    return result;
  } finally {
    clearTimeout(timer);
  }
}
