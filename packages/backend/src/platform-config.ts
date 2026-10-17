import { PlatformError, PLATFORM_ERROR_CODES } from './platform-error';

/** Frozen security ops config — not O06 retention/region/SLA. */
export type PlatformSecurityConfig = {
  inviteTtlSeconds: number;
  supportTtlMaxSeconds: number;
  mfaAuthTimeMaxSeconds: number;
  mfaAcrValues: string[];
  platformAudience: string;
};

const DEFAULT_INVITE_TTL = 48 * 3600;
const DEFAULT_SUPPORT_TTL_MAX = 3600;
const DEFAULT_MFA_AUTH_TIME_MAX = 15 * 60;

/**
 * Production missing assurance/expiry config → fail closed.
 * Dev may use defaults when PLATFORM_* unset.
 */
export function readPlatformSecurityConfig(
  env: NodeJS.ProcessEnv,
): PlatformSecurityConfig {
  const nodeEnv = env['NODE_ENV'] ?? 'development';
  const inviteRaw = env['PLATFORM_INVITE_TTL_SECONDS']?.trim();
  const supportRaw = env['PLATFORM_SUPPORT_TTL_MAX_SECONDS']?.trim();
  const mfaRaw = env['PLATFORM_MFA_AUTH_TIME_MAX_SECONDS']?.trim();
  const acrRaw = env['PLATFORM_MFA_ACR_VALUES']?.trim();
  const audience =
    env['PLATFORM_OIDC_AUDIENCE']?.trim() ||
    env['OIDC_AUDIENCE']?.trim() ||
    (nodeEnv === 'production' ? '' : 'platform-api');

  if (nodeEnv === 'production') {
    if (!inviteRaw || !supportRaw || !mfaRaw || !acrRaw || !audience) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.PLATFORM_MISCONFIGURED,
        'Platform security config required in production',
      );
    }
  }

  const inviteTtlSeconds = inviteRaw
    ? Number(inviteRaw)
    : DEFAULT_INVITE_TTL;
  const supportTtlMaxSeconds = supportRaw
    ? Number(supportRaw)
    : DEFAULT_SUPPORT_TTL_MAX;
  const mfaAuthTimeMaxSeconds = mfaRaw
    ? Number(mfaRaw)
    : DEFAULT_MFA_AUTH_TIME_MAX;
  const mfaAcrValues = (acrRaw || '2')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (
    !Number.isFinite(inviteTtlSeconds) ||
    inviteTtlSeconds < 60 ||
    inviteTtlSeconds > 7 * 86400 ||
    !Number.isFinite(supportTtlMaxSeconds) ||
    supportTtlMaxSeconds < 60 ||
    supportTtlMaxSeconds > 3600 ||
    !Number.isFinite(mfaAuthTimeMaxSeconds) ||
    mfaAuthTimeMaxSeconds < 60 ||
    mfaAuthTimeMaxSeconds > 3600 ||
    mfaAcrValues.length === 0 ||
    !audience
  ) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.PLATFORM_MISCONFIGURED,
      'Invalid platform security config',
    );
  }

  return {
    inviteTtlSeconds: Math.floor(inviteTtlSeconds),
    supportTtlMaxSeconds: Math.floor(supportTtlMaxSeconds),
    mfaAuthTimeMaxSeconds: Math.floor(mfaAuthTimeMaxSeconds),
    mfaAcrValues,
    platformAudience: audience,
  };
}
