/** Default JSON body size (most routes). */
export const DEFAULT_JSON_BODY_LIMIT_BYTES = 1024 * 1024;

/** CSV import multipart route — matches IMPORT_LIMITS.maxBytes + headroom. */
export const IMPORT_UPLOAD_BODY_LIMIT_BYTES = 11 * 1024 * 1024;

export const API_RATE_BUCKETS = {
  redeem: 'api.redeem',
  gateReserve: 'api.gate.reserve',
  gateConfirm: 'api.gate.confirm',
  gateOfflineSync: 'api.gate.offline-sync',
  publicRead: 'api.public.read',
  tenantRegistration: 'api.public.tenant-registration',
} as const;

/** Hourly caps via notification_rate_counters (same window as resolve). */
export const API_RATE_LIMITS = {
  redeemPerUser: 120,
  gateReservePerUser: 240,
  gateConfirmPerUser: 240,
  gateOfflineSyncPerUser: 60,
  publicReadPerIp: 600,
  tenantRegistrationPerIp: 20,
} as const;
