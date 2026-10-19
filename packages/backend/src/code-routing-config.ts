import { IssueError, ISSUE_ERROR_CODES } from './issue-error';
import {
  readCodeHmacEnvironment,
  type CodeHmacConfig,
} from './code-hmac';

/** All pepper versions used for digest alias insert + global resolve lookup. */
export function readSupportedPepperConfigs(
  env: NodeJS.ProcessEnv,
): CodeHmacConfig[] {
  const current = readCodeHmacEnvironment(env);
  const versions = new Map<number, CodeHmacConfig>();
  versions.set(current.version, current);

  const legacyJson = env['CODE_HMAC_LEGACY_PEPPERS']?.trim();
  if (legacyJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(legacyJson);
    } catch {
      throw new IssueError(
        ISSUE_ERROR_CODES.CODE_HMAC_MISCONFIGURED,
        'CODE_HMAC_LEGACY_PEPPERS must be valid JSON',
      );
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new IssueError(
        ISSUE_ERROR_CODES.CODE_HMAC_MISCONFIGURED,
        'CODE_HMAC_LEGACY_PEPPERS must be a JSON object',
      );
    }
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const version = Number(key);
      if (!Number.isInteger(version) || version < 1) continue;
      const pepper = typeof value === 'string' ? value.trim() : '';
      if (pepper.length < 16) {
        throw new IssueError(
          ISSUE_ERROR_CODES.CODE_HMAC_MISCONFIGURED,
          `Legacy pepper v${version} must be ≥16 bytes`,
        );
      }
      versions.set(version, { pepper, version });
    }
  }

  return [...versions.values()].sort((a, b) => a.version - b.version);
}

export function readRoutingFingerprintSecret(env: NodeJS.ProcessEnv): string {
  const secret =
    env['CODE_ROUTING_FP_SECRET']?.trim() ??
    env['CODE_HMAC_PEPPER']?.trim() ??
    '';
  if (secret.length < 16) {
    throw new IssueError(
      ISSUE_ERROR_CODES.CODE_HMAC_MISCONFIGURED,
      'CODE_ROUTING_FP_SECRET or CODE_HMAC_PEPPER required (≥16 bytes)',
    );
  }
  return secret;
}

export function readResolveTokenSecret(env: NodeJS.ProcessEnv): string {
  const key =
    env['REDEMPTION_RESOLVE_TOKEN_SECRET']?.trim() ??
    env['TICKET_CREDENTIAL_KEY']?.trim() ??
    '';
  if (key.length < 16) {
    throw new IssueError(
      ISSUE_ERROR_CODES.CODE_HMAC_MISCONFIGURED,
      'REDEMPTION_RESOLVE_TOKEN_SECRET or TICKET_CREDENTIAL_KEY required',
    );
  }
  return key;
}

export function isSingleCodeResolveGlobalEnabled(
  env: NodeJS.ProcessEnv,
): boolean {
  const raw = env['SINGLE_CODE_RESOLVE_GLOBAL']?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on';
}
