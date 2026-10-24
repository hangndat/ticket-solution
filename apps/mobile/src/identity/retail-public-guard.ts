import { VEMOKI_PROD_PUBLIC } from './vemoki-public-constants.ts';

const PROD_API_ORIGIN = VEMOKI_PROD_PUBLIC.apiBaseUrl.replace(/\/+$/, '');

export type ApsEnvSignals = {
  appVariant?: string;
  apsEnvironment?: string;
  publicApsEnvironment?: string;
};

export function readApsEnvSignals(
  env: NodeJS.ProcessEnv = process.env,
): ApsEnvSignals {
  return {
    appVariant: env.APP_VARIANT?.trim() || undefined,
    apsEnvironment: env.APS_ENVIRONMENT?.trim() || undefined,
    publicApsEnvironment: env.EXPO_PUBLIC_APS_ENVIRONMENT?.trim() || undefined,
  };
}

function hasProductionIntent(signals: ApsEnvSignals): boolean {
  return (
    signals.appVariant === 'production' ||
    signals.apsEnvironment === 'production' ||
    signals.publicApsEnvironment === 'production'
  );
}

function hasDevelopmentIntent(signals: ApsEnvSignals): boolean {
  return (
    signals.appVariant === 'development' ||
    signals.apsEnvironment === 'development' ||
    signals.publicApsEnvironment === 'development'
  );
}

/**
 * Production intent must not be overridden by a conflicting development APS indicator.
 */
export function assertApsEnvironmentConsistency(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const signals = readApsEnvSignals(env);
  if (hasProductionIntent(signals) && hasDevelopmentIntent(signals)) {
    throw new Error(
      'Conflicting APS environment: production intent (APP_VARIANT / EXPO_PUBLIC_APS_ENVIRONMENT / APS_ENVIRONMENT=production) cannot coexist with development indicators.',
    );
  }
}

/** Config-time APS bake: any explicit production marker wins; otherwise development. */
export function resolveApsEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): 'development' | 'production' {
  assertApsEnvironmentConsistency(env);
  const signals = readApsEnvSignals(env);
  if (hasProductionIntent(signals)) return 'production';
  return 'development';
}

export function isTruthyUatSessionFlag(value: string | undefined): boolean {
  const v = value?.trim();
  return v === '1' || v === 'true';
}

function normalizeApiOrigin(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** True when URL is not the pinned production API origin. */
export function isNonProductionApiOrigin(url: string): boolean {
  const normalized = normalizeApiOrigin(url);
  if (!normalized) return false;
  return normalized !== PROD_API_ORIGIN;
}

/**
 * Fail config generation for retail / production APS when UAT or non-pinned API is set.
 */
export function assertRetailPublicEnv(
  apsEnvironment: 'development' | 'production',
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (apsEnvironment !== 'production') return;

  if (isTruthyUatSessionFlag(env.EXPO_PUBLIC_ALLOW_UAT_SESSION)) {
    throw new Error(
      'Production bake cannot set EXPO_PUBLIC_ALLOW_UAT_SESSION. Use development APS / Debug for local UAT.',
    );
  }

  const api = env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (api && isNonProductionApiOrigin(api)) {
    throw new Error(
      `Production bake cannot use EXPO_PUBLIC_API_BASE_URL=${api}. Pin to ${PROD_API_ORIGIN}.`,
    );
  }
}

export type DevelopmentBakeFlags = {
  allowLocalFixtureApi: boolean;
  allowUatSessionRoutes: boolean;
  allowFixtureEventRoutes: boolean;
};

/** Baked into extra.ticketPublic for development APS only (evaluated at config time). */
export function resolveDevelopmentBakeFlags(
  env: NodeJS.ProcessEnv = process.env,
): DevelopmentBakeFlags {
  const uat = isTruthyUatSessionFlag(env.EXPO_PUBLIC_ALLOW_UAT_SESSION);
  const fixture = env.EXPO_PUBLIC_ALLOW_FIXTURE_EVENTS?.trim() === '1';
  return {
    allowLocalFixtureApi: uat,
    allowUatSessionRoutes: uat,
    allowFixtureEventRoutes: fixture,
  };
}
