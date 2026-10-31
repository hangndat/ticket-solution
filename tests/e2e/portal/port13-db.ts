import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

/** Harness spawns the Playwright process with cwd = repo root (run.mjs). */
const requireBackend = createRequire(
  resolve(process.cwd(), 'packages/backend/package.json'),
);
const backend = requireBackend('./dist/index.js');

/**
 * PORT-13 fixture gap: tests/e2e/harness/seed.mjs (owned by Gonic) provisions
 * one ACTIVE tenant per case. The cross-tenant saved-view AC needs a SECOND
 * ACTIVE tenant for the SAME owner userId, which no shared fixture provides.
 * Creates it directly through the real runtime role (DATABASE_URL / RLS,
 * same mechanism tests/e2e/harness/seed.mjs itself uses) without touching
 * the shared seed/contract files.
 */
export async function createSecondOwnerTenant(opts: {
  databaseUrl: string;
  ownerUserId: string;
  slugPrefix: string;
}): Promise<{ tenantId: string; tenantSlug: string }> {
  const db = backend.createDatabase(opts.databaseUrl, 2) as {
    $disconnect: () => Promise<void>;
  };
  try {
    const tenantId = randomUUID();
    const tenantSlug = `${opts.slugPrefix}-${tenantId.slice(0, 8)}`;
    await backend.withTenant(
      db,
      tenantId,
      async (tx: Parameters<typeof backend.grantMembership>[0]) => {
        await (
          tx as unknown as {
            tenant: { create: (args: unknown) => Promise<unknown> };
          }
        ).tenant.create({
          data: {
            id: tenantId,
            slug: tenantSlug,
            name: `PORT-13 second tenant ${tenantId.slice(0, 8)}`,
          },
        });
        await backend.grantMembership(tx, {
          tenantId,
          userId: opts.ownerUserId,
          role: 'Owner',
          permissions: backend.tenantPermissionsForRole('Owner'),
        });
      },
    );
    return { tenantId, tenantSlug };
  } finally {
    await db.$disconnect();
  }
}
