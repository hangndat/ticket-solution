/**
 * Bounded, redacted telemetry errors (no raw stderr stacks or secrets).
 */
const MAX_MESSAGE_LEN = 240;

export function formatTelemetryError(err) {
  const code = err?.code && String(err.code).length < 40 ? String(err.code) : 'telemetry_error';
  let message = 'telemetry operation failed';
  if (err?.message && typeof err.message === 'string') {
    message = err.message
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
      .replace(/sk-[A-Za-z0-9]+/gi, 'sk-[redacted]')
      .slice(0, MAX_MESSAGE_LEN);
  }
  return JSON.stringify({ ok: false, error: { code, message } });
}

export class TelemetryError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'TelemetryError';
  }
}
