/**
 * Load + validate infra/platform/security-config.json (fail closed in production).
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function securityConfigPath() {
  return (
    process.env.PLATFORM_SECURITY_CONFIG ||
    path.join(ROOT, 'infra/platform/security-config.json')
  );
}

export function loadSecurityConfig({ requireProductionKeys = null } = {}) {
  const filePath = securityConfigPath();
  const isProd =
    requireProductionKeys ??
    (process.env.NODE_ENV === 'production' ||
      process.env.PLATFORM_ENV === 'production');

  if (!existsSync(filePath)) {
    if (isProd) {
      throw new Error(
        `PLATFORM_SECURITY_CONFIG missing (${filePath}) — fail closed`,
      );
    }
    throw new Error(`security-config not found: ${filePath}`);
  }

  const raw = readFileSync(filePath, 'utf8');
  const cfg = JSON.parse(raw);

  const inviteTtl = cfg?.invite?.ttlHours;
  const supportMax = cfg?.supportGrant?.maxTtlHours;
  const stepUp = cfg?.mfaStepUp?.maxAuthTimeAgeMinutes;
  const acr = cfg?.mfaStepUp?.requiredAcr;
  const platformAud = cfg?.oidc?.platformAudience;

  if (
    typeof inviteTtl !== 'number' ||
    typeof supportMax !== 'number' ||
    typeof stepUp !== 'number' ||
    !acr ||
    !platformAud
  ) {
    const msg =
      'security-config incomplete (invite.ttlHours, supportGrant.maxTtlHours, mfaStepUp.*, oidc.platformAudience)';
    if (isProd || cfg.productionFailClosed) {
      throw new Error(`${msg} — fail closed`);
    }
    throw new Error(msg);
  }

  if (cfg?.o06?.retentionRegionSla && cfg.o06.retentionRegionSla !== 'UNRESOLVED') {
    // Allowed to evolve later; never invent numbers here.
  }

  return { cfg, filePath, isProd };
}

export function assertMobileHasNoPlatformAudience(realmClients) {
  const mobile = realmClients.find((c) => c.clientId === 'ticket-mobile');
  if (!mobile) throw new Error('ticket-mobile client missing in realm');
  const mappers = mobile.protocolMappers || [];
  for (const m of mappers) {
    const aud = m?.config?.['included.client.audience'];
    if (aud === 'ticket-platform-api') {
      throw new Error('ticket-mobile must not receive ticket-platform-api audience');
    }
  }
}
