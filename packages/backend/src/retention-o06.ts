/**
 * O06 retention constants (DECISION-LOG 2026-10-18). Do not change numbers here
 * without a new DECISION-LOG entry — product policy, not config.
 *
 * Account anonymize is wired into the worker poll loop.
 * Ticket PII (365d) and object purge (90d) have no dedicated job table yet —
 * stubs below are intentional YAGNI hooks for a future scheduler.
 */

export const O06_ACCOUNT_ANONYMIZE_MAX_DAYS = 30 as const;
export const O06_ACCOUNT_ANONYMIZE_POLICY_VERSION = 'O06-2026-10-18' as const;
export const O06_TICKET_PII_RETENTION_DAYS = 365 as const;
export const O06_OBJECT_RETENTION_DAYS = 90 as const;
export const O06_AUDIT_TTL_DAYS = 730 as const;

/** Placeholder until event-end → +365d anonymize has a claim table / outbox type. */
export async function processDueTicketPiiAnonymizations(_limit = 50): Promise<{
  scanned: number;
  applied: number;
  skippedReason: 'NO_JOB_FRAMEWORK';
}> {
  return { scanned: 0, applied: 0, skippedReason: 'NO_JOB_FRAMEWORK' };
}

/** Placeholder until export/QR object expiry has a purge claim beyond export lease. */
export async function processDueObjectRetentions(_limit = 50): Promise<{
  scanned: number;
  applied: number;
  skippedReason: 'NO_JOB_FRAMEWORK';
}> {
  return { scanned: 0, applied: 0, skippedReason: 'NO_JOB_FRAMEWORK' };
}
