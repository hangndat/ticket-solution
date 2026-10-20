/** Dev-only, redacted gate scan tracing for physical-device debugging. */
export function traceGateScan(
  event: string,
  fields: Record<string, string | number | boolean | null | undefined>,
): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.length > 120) {
      safe[key] = `${value.slice(0, 40)}…(${value.length})`;
    } else {
      safe[key] = value;
    }
  }
  console.info(`[gate-scan] ${event}`, safe);
}
