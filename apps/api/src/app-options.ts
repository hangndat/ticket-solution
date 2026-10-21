import {
  IdentityError,
  type CodeHmacConfig,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';

export type CreateAppOptions = {
  logging?: boolean;
  /**
   * When true, wire OIDC + Prisma users from `env` (default process.env).
   * Tests should inject verifier/users or leave this unset (fail closed).
   */
  fromEnv?: boolean;
  /** Override process.env when fromEnv is true. */
  env?: NodeJS.ProcessEnv;
  oidcVerifier?: OidcVerifier;
  users?: IdentityUserRepository;
  /** When set, identity stack is intentionally unavailable (fail closed). */
  identityBootError?: IdentityError;
  /** Owned Prisma client closed on app destroy when created from env. */
  databaseUrl?: string;
  /** Inject DB for redeem/tickets (tests). */
  database?: PrismaClient;
  hmac?: CodeHmacConfig;
  credentialKey?: string;
};
