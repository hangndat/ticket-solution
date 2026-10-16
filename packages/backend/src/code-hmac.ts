import { createHmac, timingSafeEqual } from 'node:crypto';
import { IssueError, ISSUE_ERROR_CODES } from './issue-error';

const MIN_PEPPER_BYTES = 16;

export type CodeHmacConfig = {
  /** Current pepper (utf8 or hex). Never commit real production values. */
  pepper: string;
  version: number;
};

/** Read CODE_HMAC_PEPPER (+ optional CODE_HMAC_VERSION) from env. */
export function readCodeHmacEnvironment(
  env: NodeJS.ProcessEnv,
): CodeHmacConfig {
  const pepper = env['CODE_HMAC_PEPPER']?.trim();
  if (!pepper || Buffer.byteLength(pepper, 'utf8') < MIN_PEPPER_BYTES) {
    throw new IssueError(
      ISSUE_ERROR_CODES.CODE_HMAC_MISCONFIGURED,
      'CODE_HMAC_PEPPER must be set (≥16 bytes)',
    );
  }
  const versionRaw = env['CODE_HMAC_VERSION'] ?? '1';
  const version = Number(versionRaw);
  if (!Number.isInteger(version) || version < 1) {
    throw new IssueError(
      ISSUE_ERROR_CODES.CODE_HMAC_MISCONFIGURED,
      'CODE_HMAC_VERSION must be a positive integer',
    );
  }
  return { pepper, version };
}

/** HMAC-SHA256 hex of normalized redemption code. Never store plaintext codes. */
export function hashRedemptionCode(
  config: CodeHmacConfig,
  rawCode: string,
): string {
  const normalized = rawCode.trim().toUpperCase();
  if (!normalized || normalized.length > 128) {
    throw new IssueError(
      ISSUE_ERROR_CODES.CODE_INVALID,
      'Redemption code format is invalid',
    );
  }
  return createHmac('sha256', config.pepper)
    .update(`v${config.version}:${normalized}`)
    .digest('hex');
}

export function codesEqualHmac(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
