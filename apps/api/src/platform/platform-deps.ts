import {
  createDatabase,
  createOidcVerifier,
  createPlatformOidcVerifier,
  createPrismaIdentityUserRepository,
  readOidcEnvironment,
  readPlatformSecurityConfig,
  type IdentityUserRepository,
  type OidcVerifier,
  type PlatformOidcVerifier,
  type PlatformSecurityConfig,
  type PrismaClient,
} from '@ticket/backend';

export type PlatformDeps = {
  db: PrismaClient | null;
  /** MFA / platform audience — /platform/* only. */
  platformVerifier: PlatformOidcVerifier | null;
  /** Standard attendee/staff OIDC (ticket-api) — /me/* self routes. */
  identityVerifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  security: PlatformSecurityConfig | null;
  bootError: Error | null;
};

export function buildPlatformDeps(
  env: NodeJS.ProcessEnv,
  db: PrismaClient | null,
): PlatformDeps {
  try {
    const security = readPlatformSecurityConfig(env);
    const platformOidc = readOidcEnvironment({
      ...env,
      OIDC_AUDIENCE: security.platformAudience,
    });
    const platformVerifier = createPlatformOidcVerifier(platformOidc, security);
    // Attendee/staff audience from env OIDC_AUDIENCE (ticket-api) — no MFA step-up.
    const identityVerifier = createOidcVerifier(readOidcEnvironment(env));
    const users = db ? createPrismaIdentityUserRepository(db, { env }) : null;
    return {
      db,
      platformVerifier,
      identityVerifier,
      users,
      security,
      bootError: null,
    };
  } catch (error) {
    return {
      db,
      platformVerifier: null,
      identityVerifier: null,
      users: null,
      security: null,
      bootError: error instanceof Error ? error : new Error('platform boot'),
    };
  }
}

void createDatabase;
