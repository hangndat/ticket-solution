#!/usr/bin/env bash
# Validate frozen platform security-config + realm audience posture (no Keycloak up).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
import {
  loadSecurityConfig,
  assertMobileHasNoPlatformAudience,
} from './scripts/lib/platform-security-config.mjs';

const { cfg, filePath } = loadSecurityConfig({ requireProductionKeys: true });
if (cfg.invite.ttlHours !== 48) throw new Error('invite TTL must be 48h');
if (cfg.supportGrant.maxTtlHours !== 1) throw new Error('support max TTL must be 1h');
if (cfg.mfaStepUp.maxAuthTimeAgeMinutes !== 15) {
  throw new Error('MFA step-up must be 15 minutes');
}
if (cfg.mfaStepUp.requiredAcr !== '2') throw new Error('requiredAcr must be 2');
if (cfg.o06.retentionRegionSla !== 'UNRESOLVED') {
  throw new Error('O06 must stay UNRESOLVED in this freeze');
}

const realm = JSON.parse(
  readFileSync('infra/keycloak/realm-ticket.json', 'utf8'),
);
const ids = new Set(realm.clients.map((c) => c.clientId));
for (const id of [
  'ticket-platform-api',
  'ticket-platform-web',
  'ticket-admin-web',
  'ticket-web',
  'ticket-mobile',
  'ticket-api',
]) {
  if (!ids.has(id)) throw new Error(`realm missing client ${id}`);
}
assertMobileHasNoPlatformAudience(realm.clients);

// Flow binding applied post-import by platform-keycloak-apply-realm.sh
// (Keycloak cannot resolve overrides in the same JSON import as the flow).
const bindings = JSON.parse(
  readFileSync('infra/platform/keycloak-flow-bindings.json', 'utf8'),
);
if (!bindings.bindBrowserOverride.includes('ticket-platform-web')) {
  throw new Error('bindings must include ticket-platform-web');
}
if (!bindings.doNotBind.includes('ticket-web')) {
  throw new Error('bindings must exclude ticket-web from OTP');
}

const platform = realm.clients.find((c) => c.clientId === 'ticket-platform-web');
const hasAcr = (platform.protocolMappers || []).some(
  (m) => m.name === 'acr-mfa-2' || m.config?.['claim.name'] === 'acr',
);
if (!hasAcr) throw new Error('ticket-platform-web missing acr-mfa-2 mapper');
const hasAuthTime = (platform.protocolMappers || []).some(
  (m) => m.name === 'auth-time' || m.config?.['claim.name'] === 'auth_time',
);
if (!hasAuthTime) throw new Error('ticket-platform-web missing auth_time mapper');

console.log(`PLATFORM_SECURITY_CONFIG_SMOKE_PASS file=${filePath}`);
console.log('invite_ttl_h=48 support_max_h=1 mfa_stepup_min=15 acr=2 o06=UNRESOLVED');
NODE
