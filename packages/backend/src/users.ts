import { randomUUID } from 'node:crypto';
import type { PrismaClient } from './generated/prisma/client';
import type { VerifiedIdentity } from './oidc';

export type StoredUser = {
  userId: string;
  issuer: string;
  subject: string;
  email: string | null;
  emailVerified: boolean;
};

export type IdentityUserRepository = {
  upsertFromVerifiedIdentity(identity: VerifiedIdentity): Promise<StoredUser>;
};

/**
 * Persist OIDC identity on the global users table.
 * Must not run inside withTenant — users are not tenant-scoped.
 */
export function createPrismaIdentityUserRepository(
  db: PrismaClient,
): IdentityUserRepository {
  return {
    async upsertFromVerifiedIdentity(identity) {
      const row = await db.user.upsert({
        where: {
          issuer_subject: {
            issuer: identity.issuer,
            subject: identity.subject,
          },
        },
        create: {
          id: randomUUID(),
          issuer: identity.issuer,
          subject: identity.subject,
          email: identity.email,
          emailVerified: identity.emailVerified,
        },
        update: {
          email: identity.email,
          emailVerified: identity.emailVerified,
        },
      });
      return {
        userId: row.id,
        issuer: row.issuer,
        subject: row.subject,
        email: row.email,
        emailVerified: row.emailVerified,
      };
    },
  };
}
