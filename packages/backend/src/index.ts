import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from './generated/prisma/client';

export { PrismaClient, Prisma };
export {
  IdentityError,
  IDENTITY_ERROR_CODES,
  type IdentityErrorCode,
} from './identity-error';
export {
  readOidcEnvironment,
  createOidcVerifier,
  createLocalJwks,
  type OidcConfig,
  type OidcVerifier,
  type VerifiedIdentity,
  type CreateOidcVerifierOptions,
} from './oidc';
export {
  createPrismaIdentityUserRepository,
  type IdentityUserRepository,
  type StoredUser,
} from './users';
export { AuthzError, AUTHZ_ERROR_CODES, type AuthzErrorCode } from './authz-error';
export {
  isMembershipActive,
  lockActiveMembershipForShare,
  requireTenantPermission,
  grantMembership,
  grantEventAssignment,
  revokeMembership,
  revokeEventAssignment,
  type MembershipRecord,
  type EventAssignmentRecord,
  type RequireTenantPermissionInput,
  type GrantMembershipInput,
  type GrantEventAssignmentInput,
} from './membership';

export function createDatabase(
  connectionString: string,
  max = 5,
): PrismaClient {
  validateDatabaseUrl(connectionString);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max }) });
}

export function validateDatabaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      !url.pathname.slice(1)
    )
      throw new Error();
    return value;
  } catch {
    throw new Error(
      'DATABASE_URL must be a PostgreSQL URL with host and database',
    );
  }
}

/** Only call after identity, active membership and operation authorization.
 * This primitive is not authentication: never populate it from an unchecked header.
 * Callback must use tx exclusively and must not escape/retain it.
 * Do not use for the global users table.
 */
export async function withTenant<T>(
  db: PrismaClient,
  tenantId: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      tenantId,
    )
  ) {
    throw new Error('Invalid tenant ID');
  }
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      await tx.$queryRaw`SELECT set_config('statement_timeout', '5000', true)`;
      return operation(tx);
    },
    { maxWait: 5000, timeout: 10000 },
  );
}

export function readProcessEnvironment(env: NodeJS.ProcessEnv) {
  const nodeEnv = env['NODE_ENV'] ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv))
    throw new Error('Invalid NODE_ENV');
  return { nodeEnv };
}
