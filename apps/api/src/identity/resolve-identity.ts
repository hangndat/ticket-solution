import {
  createDatabase,
  createOidcVerifier,
  createPrismaIdentityUserRepository,
  IdentityError,
  readOidcEnvironment,
  type CodeHmacConfig,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';
import { IDENTITY_ERROR_CODES } from '@ticket/contracts';
import { resolveIssueDeps } from '../tickets';
import type { CreateAppOptions } from '../app-options';

export function resolveIdentity(options: CreateAppOptions): {
  verifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  bootError: IdentityError | null;
  db: PrismaClient | null;
  ownsDb: boolean;
  hmac: CodeHmacConfig | null;
  credentialKey: string | null;
} {
  if (options.identityBootError) {
    return {
      verifier: null,
      users: null,
      bootError: options.identityBootError,
      db: null,
      ownsDb: false,
      hmac: null,
      credentialKey: null,
    };
  }
  if (options.oidcVerifier && options.users) {
    const env = options.env ?? process.env;
    const issue = resolveIssueDeps(env);
    return {
      verifier: options.oidcVerifier,
      users: options.users,
      bootError: null,
      db: options.database ?? null,
      ownsDb: false,
      hmac: options.hmac ?? issue.hmac,
      credentialKey: options.credentialKey ?? issue.credentialKey,
    };
  }

  if (
    !options.fromEnv &&
    !options.env &&
    !options.databaseUrl &&
    !options.database
  ) {
    return {
      verifier: null,
      users: null,
      bootError: new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Identity services are not configured',
      ),
      db: null,
      ownsDb: false,
      hmac: null,
      credentialKey: null,
    };
  }

  const env = options.env ?? process.env;
  let verifier: OidcVerifier | null = options.oidcVerifier ?? null;
  let bootError: IdentityError | null = null;
  if (!verifier) {
    try {
      verifier = createOidcVerifier(readOidcEnvironment(env));
    } catch (error) {
      if (error instanceof IdentityError) bootError = error;
      else throw error;
    }
  }

  let db: PrismaClient | null = options.database ?? null;
  let ownsDb = false;
  let users: IdentityUserRepository | null = options.users ?? null;
  if (!users) {
    const databaseUrl = options.databaseUrl ?? env['DATABASE_URL'];
    if (!databaseUrl?.trim() && !db) {
      bootError =
        bootError ??
        new IdentityError(
          IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
          'Database is not configured for identity persistence',
        );
    } else if (!db && databaseUrl) {
      db = createDatabase(databaseUrl);
      ownsDb = true;
      users = createPrismaIdentityUserRepository(db, { env });
    } else if (db) {
      users = createPrismaIdentityUserRepository(db, { env });
    }
  }

  const issue = resolveIssueDeps(env);
  return {
    verifier,
    users,
    bootError,
    db,
    ownsDb,
    hmac: options.hmac ?? issue.hmac,
    credentialKey: options.credentialKey ?? issue.credentialKey,
  };
}
