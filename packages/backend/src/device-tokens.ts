import { randomUUID } from 'node:crypto';
import type { PrismaClient } from './generated/prisma/client';
import {
  DeviceTokenError,
  DEVICE_TOKEN_ERROR_CODES,
} from './device-token-error';
import { withActor } from './tenant-context';

export type DeviceTokenRegistration = {
  registrationId: string;
  environment: 'sandbox' | 'production';
  registeredAt: string;
};

function normalizeToken(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new DeviceTokenError(
      DEVICE_TOKEN_ERROR_CODES.TOKEN_REQUIRED,
      'Device token required',
    );
  }
  const token = raw.trim();
  if (token.length < 16 || token.length > 512) {
    throw new DeviceTokenError(
      DEVICE_TOKEN_ERROR_CODES.TOKEN_REQUIRED,
      'Device token required',
    );
  }
  return token;
}

/**
 * Register APNs device token for the authenticated user (actor-scoped RLS).
 * Same physical token is reassigned atomically via SECURITY DEFINER revoke of
 * prior owners, then insert/update under app.actor_id.
 */
export async function registerDeviceToken(
  db: PrismaClient,
  input: {
    userId: string;
    token: unknown;
    environment: unknown;
  },
): Promise<DeviceTokenRegistration> {
  const token = normalizeToken(input.token);
  if (input.environment !== 'sandbox' && input.environment !== 'production') {
    throw new DeviceTokenError(
      DEVICE_TOKEN_ERROR_CODES.INVALID_ENVIRONMENT,
      'environment must be sandbox or production',
    );
  }
  const environment = input.environment;

  return withActor(db, input.userId, async (tx) => {
    // Serialize concurrent reassignment of the same physical token.
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${token}::text, 0))
    `;
    // Drop every active owner of this token (including prior accounts).
    await tx.$queryRaw`
      SELECT revoke_active_device_tokens_by_value(${token}::text)
    `;

    const mine = await tx.$queryRaw<
      { id: string; environment: string; created_at: Date; revoked_at: Date | null }[]
    >`
      SELECT id, environment, created_at, revoked_at
      FROM device_tokens
      WHERE user_id = ${input.userId}::uuid
        AND token = ${token}
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
    `;

    const existing = mine[0];
    if (existing && existing.revoked_at === null) {
      if (existing.environment !== environment) {
        await tx.$executeRaw`
          UPDATE device_tokens
          SET environment = ${environment},
              updated_at = clock_timestamp()
          WHERE id = ${existing.id}::uuid
            AND user_id = ${input.userId}::uuid
            AND revoked_at IS NULL
        `;
      }
      return {
        registrationId: existing.id,
        environment,
        registeredAt: existing.created_at.toISOString(),
      };
    }

    // Re-activate own revoked row for same token, or insert fresh.
    if (existing && existing.revoked_at !== null) {
      await tx.$executeRaw`
        UPDATE device_tokens
        SET revoked_at = NULL,
            environment = ${environment},
            updated_at = clock_timestamp()
        WHERE id = ${existing.id}::uuid
          AND user_id = ${input.userId}::uuid
      `;
      return {
        registrationId: existing.id,
        environment,
        registeredAt: existing.created_at.toISOString(),
      };
    }

    const registrationId = randomUUID();
    const registeredAt = new Date();
    await tx.$executeRaw`
      INSERT INTO device_tokens (
        id, user_id, token, environment, created_at, updated_at
      ) VALUES (
        ${registrationId}::uuid, ${input.userId}::uuid, ${token},
        ${environment}, ${registeredAt}::timestamptz, ${registeredAt}::timestamptz
      )
    `;
    return {
      registrationId,
      environment,
      registeredAt: registeredAt.toISOString(),
    };
  });
}

export async function revokeDeviceToken(
  db: PrismaClient,
  input: { userId: string; registrationId: string },
): Promise<void> {
  if (
    typeof input.registrationId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      input.registrationId,
    )
  ) {
    throw new DeviceTokenError(
      DEVICE_TOKEN_ERROR_CODES.REGISTRATION_NOT_FOUND,
      'Registration not found',
    );
  }

  await withActor(db, input.userId, async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM device_tokens
      WHERE id = ${input.registrationId}::uuid
        AND user_id = ${input.userId}::uuid
        AND revoked_at IS NULL
      FOR UPDATE
    `;
    if (!rows[0]) {
      throw new DeviceTokenError(
        DEVICE_TOKEN_ERROR_CODES.REGISTRATION_NOT_FOUND,
        'Registration not found',
      );
    }
    await tx.$executeRaw`
      UPDATE device_tokens
      SET revoked_at = clock_timestamp(), updated_at = clock_timestamp()
      WHERE id = ${input.registrationId}::uuid
        AND user_id = ${input.userId}::uuid
        AND revoked_at IS NULL
    `;
  });
}

/** Server-learned APNs environment (push fallback); actor-scoped like registration updates. */
export async function correctDeviceTokenEnvironment(
  db: PrismaClient,
  input: {
    userId: string;
    registrationId: string;
    environment: 'sandbox' | 'production';
  },
): Promise<void> {
  await withActor(db, input.userId, async (tx) => {
    await tx.$executeRaw`
      UPDATE device_tokens
      SET environment = ${input.environment},
          updated_at = clock_timestamp()
      WHERE id = ${input.registrationId}::uuid
        AND user_id = ${input.userId}::uuid
        AND revoked_at IS NULL
    `;
  });
}

/** APNs BadDeviceToken / Unregistered — narrow SECURITY DEFINER, not actor RLS. */
export async function revokeDeviceTokenByValue(
  db: PrismaClient,
  token: string,
): Promise<void> {
  if (typeof token !== 'string' || !token.trim()) return;
  await db.$queryRaw`
    SELECT revoke_active_device_tokens_by_value(${token.trim()}::text)
  `;
}

/** Worker push path — SECURITY DEFINER list (token/env only). */
export async function listActiveDeviceTokensForUser(
  db: PrismaClient,
  userId: string,
): Promise<{ token: string; environment: 'sandbox' | 'production'; id: string }[]> {
  const rows = await db.$queryRaw<
    { id: string; token: string; environment: string }[]
  >`
    SELECT id, token, environment
    FROM list_active_device_tokens_for_user(${userId}::uuid)
  `;
  return rows.map((r) => ({
    id: r.id,
    token: r.token,
    environment: r.environment as 'sandbox' | 'production',
  }));
}
