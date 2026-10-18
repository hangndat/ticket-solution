import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Injectable,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import {
  type ApiError,
  type MeEventItem,
  type MeEventsResponse,
  PLATFORM_ERROR_CODES,
} from '@ticket/contracts';
import {
  PlatformError,
  IdentityError,
  IDENTITY_ERROR_CODES,
  acceptMembershipInvite,
  createAccountDeletionRequest,
  createMembershipInvite,
  createOidcVerifier,
  createPlatformOidcVerifier,
  createSupportGrant,
  getCurrentAccountDeletionRequest,
  getPlatformMe,
  getPlatformTenantDetail,
  listMyEvents,
  listMyTenants,
  listSupportTickets,
  provisionTenant,
  readOidcEnvironment,
  readPlatformSecurityConfig,
  revokeMembershipKeepingLastOwner,
  revokeSupportGrant,
  setTenantStatus,
  updateTenantLimits,
  createPrismaIdentityUserRepository,
  createDatabase,
  isMembershipRole,
  type PrismaClient,
  type PlatformSecurityConfig,
  type PlatformOidcVerifier,
  type OidcVerifier,
  type IdentityUserRepository,
} from '@ticket/backend';

class MeEventItemDto implements MeEventItem {
  @ApiProperty({ format: 'uuid' }) tenantId!: string;
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: [String] }) permissions!: string[];
}

class MeEventsDto implements MeEventsResponse {
  @ApiProperty({
    description:
      'true iff active tenant membership OR active event assignment',
  })
  staffEligible!: boolean;
  @ApiProperty({ type: [MeEventItemDto] }) items!: MeEventItemDto[];
}

type Deps = {
  db: PrismaClient | null;
  /** MFA / platform audience — /platform/* only. */
  platformVerifier: PlatformOidcVerifier | null;
  /** Standard attendee/staff OIDC (ticket-api) — /me/* self routes. */
  identityVerifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  security: PlatformSecurityConfig | null;
  bootError: Error | null;
};

function fail(error: unknown): never {
  if (error instanceof PlatformError) {
    const status =
      error.code === PLATFORM_ERROR_CODES.UNAUTHENTICATED ||
      error.code === PLATFORM_ERROR_CODES.MFA_REQUIRED
        ? 401
        : error.code === PLATFORM_ERROR_CODES.PLATFORM_OPERATOR_REQUIRED ||
            error.code === PLATFORM_ERROR_CODES.PERMISSION_DENIED ||
            error.code === PLATFORM_ERROR_CODES.MEMBERSHIP_REVOKED
          ? 403
          : error.code === PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND
            ? 404
            : error.code === PLATFORM_ERROR_CODES.SLUG_TAKEN ||
                error.code === PLATFORM_ERROR_CODES.IDEMPOTENCY_CONFLICT ||
                error.code === PLATFORM_ERROR_CODES.STALE_VERSION ||
                error.code === PLATFORM_ERROR_CODES.LAST_OWNER_REQUIRED ||
                error.code === PLATFORM_ERROR_CODES.LIMIT_BELOW_USAGE ||
                error.code === PLATFORM_ERROR_CODES.TENANT_LIMIT_REACHED ||
                error.code === PLATFORM_ERROR_CODES.INVITE_ALREADY_USED
              ? 409
              : error.code === PLATFORM_ERROR_CODES.TENANT_SUSPENDED ||
                  error.code === PLATFORM_ERROR_CODES.TENANT_PENDING
                ? 503
                : 422;
    throw new HttpException(
      {
        code: error.code,
        message: error.message,
        requestId: randomUUID(),
        retryable: error.retryable,
      } satisfies ApiError,
      status,
    );
  }
  if (error instanceof IdentityError) {
    throw new HttpException(
      {
        code: error.code,
        message: error.message,
        requestId: randomUUID(),
        retryable: error.retryable,
      } satisfies ApiError,
      error.code === IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED ? 503 : 401,
    );
  }
  throw error;
}

@Injectable()
export class PlatformService {
  constructor(private readonly deps: Deps) {}

  private async platformActor(authorization: string | undefined) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.platformVerifier || !this.deps.users || !this.deps.db) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.PLATFORM_MISCONFIGURED,
        'Platform not configured',
      );
    }
    const verified =
      await this.deps.platformVerifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity(verified);
  }

  private async selfActor(authorization: string | undefined) {
    // /me/* uses standard attendee OIDC (no MFA ACR). Do not widen platform verifier.
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.users || !this.deps.db) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Identity not configured',
      );
    }
    if (!this.deps.identityVerifier) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Identity verifier not configured',
      );
    }
    const verified =
      await this.deps.identityVerifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity({
      issuer: verified.issuer,
      subject: verified.subject,
      email: verified.email,
      emailVerified: verified.emailVerified,
    });
  }

  me(authorization: string | undefined) {
    return this.platformActor(authorization)
      .then((u) => getPlatformMe(this.deps.db!, u.userId))
      .then((r) => ({ ...r, assurance: 'mfa' as const }))
      .catch(fail);
  }

  myTenants(authorization: string | undefined) {
    return this.selfActor(authorization)
      .then(async (u) => ({ items: await listMyTenants(this.deps.db!, u.userId) }))
      .catch(fail);
  }

  myEvents(authorization: string | undefined): Promise<MeEventsResponse> {
    return this.selfActor(authorization)
      .then((u) => listMyEvents(this.deps.db!, u.userId))
      .catch(fail);
  }

  createTenant(
    authorization: string | undefined,
    idempotencyKey: string | undefined,
    body: Record<string, unknown>,
  ) {
    return this.platformActor(authorization)
      .then((u) =>
        provisionTenant(this.deps.db!, this.deps.security!, {
          actorUserId: u.userId,
          clientKey: idempotencyKey ?? '',
          body: body as never,
        }),
      )
      .then((r) => ({
        tenantId: r.tenantId,
        status: r.status,
        version: r.version,
        ownerInviteId: r.ownerInviteId,
      }))
      .catch(fail);
  }

  tenantDetail(authorization: string | undefined, tenantId: string) {
    return this.platformActor(authorization)
      .then((u) => getPlatformTenantDetail(this.deps.db!, u.userId, tenantId))
      .catch(fail);
  }

  setStatus(
    authorization: string | undefined,
    tenantId: string,
    body: { status: 'ACTIVE' | 'SUSPENDED'; reason: string; expectedVersion: number },
  ) {
    return this.platformActor(authorization)
      .then((u) =>
        setTenantStatus(this.deps.db!, {
          actorUserId: u.userId,
          tenantId,
          status: body.status,
          reason: body.reason,
          expectedVersion: body.expectedVersion,
        }),
      )
      .catch(fail);
  }

  setLimits(
    authorization: string | undefined,
    tenantId: string,
    body: {
      limits: never;
      flags: never;
      reason: string;
      expectedVersion: number;
    },
  ) {
    return this.platformActor(authorization)
      .then((u) =>
        updateTenantLimits(this.deps.db!, {
          actorUserId: u.userId,
          tenantId,
          limits: body.limits,
          flags: body.flags,
          reason: body.reason,
          expectedVersion: body.expectedVersion,
        }),
      )
      .catch(fail);
  }

  invite(
    authorization: string | undefined,
    tenantId: string,
    idempotencyKey: string | undefined,
    body: { email: string; role: string; eventAssignments?: never[] },
  ) {
    if (!isMembershipRole(body.role)) {
      return Promise.reject(
        new PlatformError(PLATFORM_ERROR_CODES.INVALID_INPUT, 'Invalid role'),
      ).catch(fail);
    }
    const role = body.role;
    return this.selfActor(authorization)
      .then((u) =>
        createMembershipInvite(this.deps.db!, this.deps.security!, {
          tenantId,
          actorUserId: u.userId,
          email: body.email,
          role,
          eventAssignments: body.eventAssignments as never,
          clientKey: idempotencyKey ?? '',
        }),
      )
      .then((r) => ({
        inviteId: r.inviteId,
        state: r.state,
        expiresAt: r.expiresAt,
        deliveryState: r.deliveryState,
      }))
      .catch(fail);
  }

  acceptInvite(
    authorization: string | undefined,
    body: { token: string },
  ) {
    return this.selfActor(authorization)
      .then((u) =>
        acceptMembershipInvite(this.deps.db!, {
          userId: u.userId,
          email: u.email,
          emailVerified: u.emailVerified,
          token: body.token,
        }),
      )
      .catch(fail);
  }

  revokeMember(
    authorization: string | undefined,
    tenantId: string,
    membershipId: string,
    body: { reason: string },
  ) {
    return this.selfActor(authorization)
      .then((u) =>
        revokeMembershipKeepingLastOwner(this.deps.db!, {
          tenantId,
          actorUserId: u.userId,
          membershipId,
          reason: body.reason,
        }),
      )
      .catch(fail);
  }

  supportGrant(authorization: string | undefined, body: never) {
    return this.platformActor(authorization)
      .then((u) =>
        createSupportGrant(this.deps.db!, this.deps.security!, {
          actorUserId: u.userId,
          ...(body as object as {
            tenantId: string;
            eventId: string;
            scopes: string[];
            reason: string;
            expiresAt: string;
          }),
        }),
      )
      .catch(fail);
  }

  supportTickets(
    authorization: string | undefined,
    tenantId: string,
    grantId: string,
  ) {
    return this.platformActor(authorization)
      .then((u) =>
        listSupportTickets(this.deps.db!, {
          actorUserId: u.userId,
          grantId,
        }),
      )
      .then((items) => ({ items }))
      .catch(fail);
  }

  requestDeletion(authorization: string | undefined, body: { confirmation: true }) {
    return this.selfActor(authorization)
      .then((u) =>
        createAccountDeletionRequest(this.deps.db!, {
          userId: u.userId,
          confirmation: body.confirmation,
        }),
      )
      .catch(fail);
  }

  currentDeletion(authorization: string | undefined) {
    return this.selfActor(authorization)
      .then((u) => getCurrentAccountDeletionRequest(this.deps.db!, u.userId))
      .catch(fail);
  }
}

@ApiTags('platform')
@Controller()
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('platform/me')
  @ApiBearerAuth()
  platformMe(@Headers('authorization') authorization: string | undefined) {
    return this.platform.me(authorization);
  }

  @Get('me/tenants')
  @ApiBearerAuth()
  myTenants(@Headers('authorization') authorization: string | undefined) {
    return this.platform.myTenants(authorization);
  }

  @Get('me/events')
  @ApiBearerAuth()
  @ApiOkResponse({ type: MeEventsDto })
  myEvents(@Headers('authorization') authorization: string | undefined) {
    return this.platform.myEvents(authorization);
  }

  @Post('platform/tenants')
  @ApiBearerAuth()
  createTenant(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.createTenant(authorization, idempotencyKey, body);
  }

  @Get('platform/tenants/:tenantId')
  @ApiBearerAuth()
  tenantDetail(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
  ) {
    return this.platform.tenantDetail(authorization, tenantId);
  }

  @Post('platform/tenants/:tenantId/status')
  @ApiBearerAuth()
  setStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Body() body: { status: 'ACTIVE' | 'SUSPENDED'; reason: string; expectedVersion: number },
  ) {
    return this.platform.setStatus(authorization, tenantId, body);
  }

  @Put('platform/tenants/:tenantId/limits')
  @ApiBearerAuth()
  setLimits(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Body() body: never,
  ) {
    return this.platform.setLimits(authorization, tenantId, body);
  }

  @Post('tenants/:tenantId/invites')
  @ApiBearerAuth()
  invite(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('tenantId') tenantId: string,
    @Body() body: { email: string; role: string },
  ) {
    return this.platform.invite(authorization, tenantId, idempotencyKey, body);
  }

  @Post('me/membership-invites/accept')
  @ApiBearerAuth()
  accept(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { token: string },
  ) {
    return this.platform.acceptInvite(authorization, body);
  }

  @Post('tenants/:tenantId/members/:membershipId/revoke')
  @ApiBearerAuth()
  revokeMember(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: { reason: string },
  ) {
    return this.platform.revokeMember(
      authorization,
      tenantId,
      membershipId,
      body,
    );
  }

  @Post('platform/support-grants')
  @ApiBearerAuth()
  supportGrant(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: never,
  ) {
    return this.platform.supportGrant(authorization, body);
  }

  @Get('platform/support-grants/:grantId/tickets')
  @ApiBearerAuth()
  supportTickets(
    @Headers('authorization') authorization: string | undefined,
    @Param('grantId') grantId: string,
  ) {
    return this.platform.supportTickets(authorization, '', grantId);
  }

  @Post('me/account-deletion-requests')
  @ApiBearerAuth()
  requestDeletion(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { confirmation: true },
  ) {
    return this.platform.requestDeletion(authorization, body);
  }

  @Get('me/account-deletion-requests/current')
  @ApiBearerAuth()
  currentDeletion(@Headers('authorization') authorization: string | undefined) {
    return this.platform.currentDeletion(authorization);
  }
}

export function buildPlatformDeps(env: NodeJS.ProcessEnv, db: PrismaClient | null): Deps {
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
void revokeSupportGrant;
