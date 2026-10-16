import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from './generated/prisma/client';
import { withTenant } from './tenant-context';

export { PrismaClient, Prisma };
export { withTenant };
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
export {
  IssueError,
  ISSUE_ERROR_CODES,
  type IssueErrorCode,
} from './issue-error';
export {
  readCodeHmacEnvironment,
  hashRedemptionCode,
  codesEqualHmac,
  type CodeHmacConfig,
} from './code-hmac';
export {
  REDEEM_COMMAND,
  redeemAndIssueTicket,
  listTicketsForOwner,
  getOperationForActor,
  throwIfStoredRejection,
  type RedeemInput,
  type IssuedTicketResult,
  type ListedTicket,
} from './issue';
export {
  seedEventInventory,
  type SeedInventoryInput,
  type SeedInventoryResult,
} from './inventory';
export {
  claimOutboxBatch,
  processClaimedOutbox,
  relayOutboxOnce,
  type ClaimedOutboxRow,
  type ProcessOutboxResult,
} from './outbox';
export {
  createNoopEmailAdapter,
  createFailingEmailAdapter,
  createSmtpEmailAdapter,
  readEmailEnvironment,
  type EmailAdapter,
  type TicketIssuedEmailPayload,
  type EmailSendResult,
  type SmtpAdapterOptions,
} from './email-adapter';

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

export function readProcessEnvironment(env: NodeJS.ProcessEnv) {
  const nodeEnv = env['NODE_ENV'] ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv))
    throw new Error('Invalid NODE_ENV');
  return { nodeEnv };
}

/** Credential sealing material for ticket QR tokens (local/dev). */
export function readCredentialKeyEnvironment(env: NodeJS.ProcessEnv): string {
  const key = env['TICKET_CREDENTIAL_KEY']?.trim();
  if (!key || key.length < 16) {
    throw new Error('TICKET_CREDENTIAL_KEY must be set (≥16 characters)');
  }
  return key;
}
