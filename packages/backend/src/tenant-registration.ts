import { createHash, randomUUID } from 'node:crypto';
import type { PrismaClient } from './generated/prisma/client';
import type {
  PublicTenantRegistrationBody,
  PublicTenantRegistrationResponse,
} from '@ticket/contracts';
import { PlatformError, PLATFORM_ERROR_CODES } from './platform-error';

/** Conservative self-serve defaults (Operator may raise later via updateTenantLimits). */
export const SELF_SERVE_DEFAULT_LIMITS = {
  maxEvents: 2,
  maxStaff: 5,
  emailPerDay: 100,
  importRowsPerJob: 5000,
} as const;

export const SELF_SERVE_DEFAULT_FLAGS = {
  importsEnabled: true,
  exportsEnabled: true,
} as const;

const DEFAULT_RATE_WINDOW_SECONDS = 24 * 3600;
const DEFAULT_RATE_MAX = 3;
const DEFAULT_MAX_PENDING_OWNED = 2;

export type SelfServeRegistrationConfig = {
  rateWindowSeconds: number;
  rateMax: number;
  maxPendingOwned: number;
};

export function readSelfServeRegistrationConfig(
  env: NodeJS.ProcessEnv = process.env,
): SelfServeRegistrationConfig {
  const windowRaw = env['SELF_SERVE_RATE_WINDOW_SECONDS']?.trim();
  const maxRaw = env['SELF_SERVE_RATE_MAX']?.trim();
  const pendingRaw = env['SELF_SERVE_MAX_PENDING_OWNED']?.trim();
  const rateWindowSeconds = windowRaw
    ? Number(windowRaw)
    : DEFAULT_RATE_WINDOW_SECONDS;
  const rateMax = maxRaw ? Number(maxRaw) : DEFAULT_RATE_MAX;
  const maxPendingOwned = pendingRaw
    ? Number(pendingRaw)
    : DEFAULT_MAX_PENDING_OWNED;
  if (
    !Number.isFinite(rateWindowSeconds) ||
    rateWindowSeconds < 60 ||
    rateWindowSeconds > 7 * 86400 ||
    !Number.isFinite(rateMax) ||
    rateMax < 1 ||
    rateMax > 100 ||
    !Number.isFinite(maxPendingOwned) ||
    maxPendingOwned < 1 ||
    maxPendingOwned > 20
  ) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.PLATFORM_MISCONFIGURED,
      'Invalid self-serve registration config',
    );
  }
  return {
    rateWindowSeconds: Math.floor(rateWindowSeconds),
    rateMax: Math.floor(rateMax),
    maxPendingOwned: Math.floor(maxPendingOwned),
  };
}

function canonicalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function requireIdempotencyKey(raw: string | undefined): string {
  const key = raw?.trim() ?? '';
  if (key.length < 8 || key.length > 128) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      'Idempotency-Key required (8–128 chars)',
    );
  }
  return key;
}

function mapSqlError(error: unknown): never {
  if (error instanceof PlatformError) throw error;
  const msg = error instanceof Error ? error.message : String(error);
  if (/rate_limited/i.test(msg)) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.RATE_LIMITED,
      'Too many tenant registrations',
      true,
    );
  }
  if (/idempotency_conflict/i.test(msg)) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'Idempotency key reuse with different payload',
    );
  }
  if (/idempotency_key_required/i.test(msg)) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      'Idempotency-Key required',
    );
  }
  if (/slug_taken|unique|duplicate/i.test(msg)) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.SLUG_TAKEN,
      'Tenant slug taken',
    );
  }
  if (/invalid_slug|invalid_input/i.test(msg)) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'Invalid tenant registration input',
    );
  }
  throw error instanceof Error ? error : new Error(String(error));
}

/**
 * Authenticated self-serve signup (P2-ONBOARD-PENDING).
 * Creates tenant PENDING + Owner membership; never auto-ACTIVE.
 * Operator activates via existing setTenantStatus.
 * Response never includes invite tokens or secrets.
 */
export async function registerPendingTenant(
  db: PrismaClient,
  input: {
    actorUserId: string;
    email: string | null;
    emailVerified: boolean;
    clientKey: string | undefined;
    body: PublicTenantRegistrationBody;
    config?: SelfServeRegistrationConfig;
  },
): Promise<PublicTenantRegistrationResponse> {
  if (!input.emailVerified || !input.email?.trim()) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'Verified email required',
    );
  }
  const email = canonicalizeEmail(input.email);
  if (!email.includes('@')) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'Verified email required',
    );
  }

  const clientKey = requireIdempotencyKey(input.clientKey);
  const slug = input.body.slug?.trim().toLowerCase() ?? '';
  const name = input.body.name?.trim() ?? '';
  const tz =
    input.body.defaultTimezone?.trim() || 'Asia/Ho_Chi_Minh';
  const contact =
    typeof input.body.contact === 'string'
      ? input.body.contact.trim() || null
      : null;

  if (
    !/^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/.test(slug) ||
    name.length < 1 ||
    name.length > 200
  ) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'Invalid tenant registration input',
    );
  }

  const config = input.config ?? readSelfServeRegistrationConfig();
  const requestHash = createHash('sha256')
    .update(
      JSON.stringify({
        slug,
        name,
        tz,
        contact,
        email,
        limits: SELF_SERVE_DEFAULT_LIMITS,
        flags: SELF_SERVE_DEFAULT_FLAGS,
      }),
    )
    .digest('hex');

  const registrationId = randomUUID();
  const tenantId = randomUUID();

  try {
    const rows = await db.$queryRaw<
      {
        out_registration_id: string;
        out_tenant_id: string;
        out_status: string;
        out_replay: boolean;
      }[]
    >`
      SELECT * FROM register_pending_tenant(
        ${registrationId}::uuid,
        ${tenantId}::uuid,
        ${slug}::text,
        ${name}::text,
        ${tz}::text,
        ${contact}::text,
        ${input.actorUserId}::uuid,
        ${clientKey}::text,
        ${requestHash}::text,
        ${SELF_SERVE_DEFAULT_LIMITS.maxEvents}::integer,
        ${SELF_SERVE_DEFAULT_LIMITS.maxStaff}::integer,
        ${SELF_SERVE_DEFAULT_LIMITS.emailPerDay}::integer,
        ${SELF_SERVE_DEFAULT_LIMITS.importRowsPerJob}::integer,
        ${SELF_SERVE_DEFAULT_FLAGS.importsEnabled}::boolean,
        ${SELF_SERVE_DEFAULT_FLAGS.exportsEnabled}::boolean,
        ${config.rateWindowSeconds}::integer,
        ${config.rateMax}::integer,
        ${config.maxPendingOwned}::integer
      )
    `;
    const row = rows[0];
    if (!row || row.out_status !== 'PENDING') {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.DEPENDENCY_UNAVAILABLE,
        'Tenant registration failed',
        true,
      );
    }
    return {
      registrationId: row.out_registration_id,
      tenantId: row.out_tenant_id,
      status: 'PENDING',
    };
  } catch (error) {
    mapSqlError(error);
  }
}
