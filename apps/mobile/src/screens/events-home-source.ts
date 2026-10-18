/**
 * Pure policy helper for Events home (ADR-19 / Issue #257).
 * Primary list source is always published API results — never demo fixtures.
 */

export type EventsHomeListSource = 'published' | 'none';

/**
 * What drives the FlatList `data` prop. Demo catalog must never appear here
 * (it belongs only in an explicit DEMO footer / fixture routes).
 */
export function eventsHomeListSource(
  publishedCount: number,
): EventsHomeListSource {
  return publishedCount > 0 ? 'published' : 'none';
}

/** True when callers must show error/empty UI instead of substituting demo. */
export function mustFailClosedWithoutDemo(
  phase: 'loading' | 'ready' | 'error' | 'misconfigured',
): boolean {
  return phase === 'error' || phase === 'misconfigured' || phase === 'ready';
}
