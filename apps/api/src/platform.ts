import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpException,
  Injectable,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  type ApiError,
  type MeEventItem,
  type MeEventsResponse,
  type PortalAssignmentBody,
  type PortalInviteRevokeResponse,
  type PortalInviteState,
  type PortalInviteSummary,
  type PortalInvitesPage,
  type PortalMemberAssignment,
  type PortalMemberRoleBody,
  type PortalMemberSummary,
  type PortalMembersPage,
  type PortalMembershipMutationResponse,
  type PortalPlatformAuditEntry,
  type PortalPlatformAuditPage,
  type PortalPlatformTenantSummary,
  type PortalPlatformTenantsPage,
  type PortalReasonBody,
  PLATFORM_ERROR_CODES,
} from '@ticket/contracts';
import {
  AuthzError,
  PlatformError,
  IdentityError,
  IDENTITY_ERROR_CODES,
  acceptMembershipInvite,
  changePortalMemberRole,
  createAccountDeletionRequest,
  createMembershipInvite,
  createOidcVerifier,
  createPlatformOidcVerifier,
  createSupportGrant,
  deletePortalEventAssignment,
  getCurrentAccountDeletionRequest,
  getPlatformMe,
  getPlatformTenantDetail,
  listMyEvents,
  listMyTenants,
  listPlatformAudit,
  listPlatformTenants,
  listPortalInvites,
  listPortalMembers,
  listSupportTickets,
  provisionTenant,
  putPortalEventAssignment,
  readOidcEnvironment,
  readPlatformSecurityConfig,
  resendPortalInvite,
  revokeMembershipKeepingLastOwner,
  revokePortalInvite,
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

const MEMBERSHIP_ROLES = [
  'Owner',
  'Manager',
  'CS',
  'Supervisor',
  'Scanner',
] as const;

class PortalMemberAssignmentDto implements PortalMemberAssignment {
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ type: [String] }) permissions!: string[];
  @ApiProperty({ nullable: true, type: String }) activatedAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) revokedAt!: string | null;
}

class PortalMemberSummaryDto implements PortalMemberSummary {
  @ApiProperty({ format: 'uuid' }) membershipId!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ nullable: true, type: String }) emailMasked!: string | null;
  @ApiProperty({ enum: MEMBERSHIP_ROLES }) role!: PortalMemberSummary['role'];
  @ApiProperty({ nullable: true, type: String }) activatedAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) revokedAt!: string | null;
  @ApiProperty({ type: [PortalMemberAssignmentDto] })
  eventAssignments!: PortalMemberAssignmentDto[];
}

class PortalMembersPageDto implements PortalMembersPage {
  @ApiProperty({ type: [PortalMemberSummaryDto] })
  items!: PortalMemberSummaryDto[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
}

class PortalInviteSummaryDto implements PortalInviteSummary {
  @ApiProperty({ format: 'uuid' }) inviteId!: string;
  @ApiProperty() emailMasked!: string;
  @ApiProperty({ enum: MEMBERSHIP_ROLES }) role!: PortalInviteSummary['role'];
  @ApiProperty({ enum: ['PENDING', 'USED', 'REVOKED', 'EXPIRED'] })
  state!: PortalInviteState;
  @ApiProperty() expiresAt!: string;
  @ApiProperty({
    enum: ['PENDING', 'ACCEPTED', 'FAILED', 'UNKNOWN'],
    description:
      'ACCEPTED = outbox processing completed; never proof of inbox delivery',
  })
  deliveryState!: PortalInviteSummary['deliveryState'];
}

class PortalInvitesPageDto implements PortalInvitesPage {
  @ApiProperty({ type: [PortalInviteSummaryDto] })
  items!: PortalInviteSummaryDto[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
}

class PortalMemberRoleBodyDto implements PortalMemberRoleBody {
  @ApiProperty({ enum: MEMBERSHIP_ROLES }) role!: PortalMemberRoleBody['role'];
  @ApiProperty() reason!: string;
}

class PortalAssignmentBodyDto implements PortalAssignmentBody {
  @ApiProperty({ enum: MEMBERSHIP_ROLES }) role!: PortalAssignmentBody['role'];
  @ApiProperty() reason!: string;
}

class PortalReasonBodyDto implements PortalReasonBody {
  @ApiProperty() reason!: string;
}

class PortalMembershipMutationResponseDto
  implements PortalMembershipMutationResponse
{
  @ApiProperty({ format: 'uuid' }) membershipId!: string;
}

class PortalInviteRevokeResponseDto implements PortalInviteRevokeResponse {
  @ApiProperty({ format: 'uuid' }) inviteId!: string;
  @ApiProperty({ enum: ['REVOKED'] }) state!: 'REVOKED';
}

class PortalInviteResendResponseDto {
  @ApiProperty({ format: 'uuid' }) inviteId!: string;
  @ApiProperty({ enum: ['PENDING'] }) state!: 'PENDING';
  @ApiProperty() expiresAt!: string;
  @ApiProperty({ enum: ['PENDING'] }) deliveryState!: 'PENDING';
}

class PortalPlatformTenantSummaryDto implements PortalPlatformTenantSummary {
  @ApiProperty({ format: 'uuid' }) tenantId!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['PENDING', 'ACTIVE', 'SUSPENDED'] })
  status!: PortalPlatformTenantSummary['status'];
  @ApiProperty() version!: number;
  @ApiProperty() createdAt!: string;
}

class PortalPlatformTenantsPageDto implements PortalPlatformTenantsPage {
  @ApiProperty({ type: [PortalPlatformTenantSummaryDto] })
  items!: PortalPlatformTenantSummaryDto[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
}

class PortalPlatformAuditEntryDto implements PortalPlatformAuditEntry {
  @ApiProperty({ format: 'uuid' }) auditId!: string;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  actorUserId!: string | null;
  @ApiProperty() action!: string;
  @ApiProperty() resourceType!: string;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  resourceId!: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  tenantId!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

class PortalPlatformAuditPageDto implements PortalPlatformAuditPage {
  @ApiProperty({ type: [PortalPlatformAuditEntryDto] })
  items!: PortalPlatformAuditEntryDto[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
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
            error.code === PLATFORM_ERROR_CODES.MEMBERSHIP_REVOKED ||
            error.code === PLATFORM_ERROR_CODES.MEMBERSHIP_REQUIRED
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
              : error.code === PLATFORM_ERROR_CODES.RATE_LIMITED
                ? 429
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
  if (error instanceof AuthzError) {
    throw new HttpException(
      {
        code: error.code,
        message: error.message,
        requestId: randomUUID(),
        retryable: false,
      } satisfies ApiError,
      403,
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

  listTenants(
    authorization: string | undefined,
    query: { cursor?: string; limit?: string },
  ) {
    const limit = query.limit ? Number(query.limit) : undefined;
    return this.platformActor(authorization)
      .then((u) =>
        listPlatformTenants(this.deps.db!, {
          actorUserId: u.userId,
          cursor: query.cursor,
          limit: Number.isFinite(limit) ? limit : undefined,
        }),
      )
      .catch(fail);
  }

  listAudit(
    authorization: string | undefined,
    query: {
      cursor?: string;
      limit?: string;
      from?: string;
      to?: string;
      action?: string;
      tenantId?: string;
    },
  ) {
    const limit = query.limit ? Number(query.limit) : undefined;
    return this.platformActor(authorization)
      .then((u) =>
        listPlatformAudit(this.deps.db!, {
          actorUserId: u.userId,
          cursor: query.cursor,
          limit: Number.isFinite(limit) ? limit : undefined,
          from: query.from,
          to: query.to,
          action: query.action,
          tenantId: query.tenantId,
        }),
      )
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

  listMembers(
    authorization: string | undefined,
    tenantId: string,
    query: { cursor?: string; limit?: string; includeRevoked?: string },
  ) {
    const limit = query.limit ? Number(query.limit) : undefined;
    return this.selfActor(authorization)
      .then((u) =>
        listPortalMembers(this.deps.db!, {
          tenantId,
          actorUserId: u.userId,
          cursor: query.cursor,
          limit: Number.isFinite(limit) ? limit : undefined,
          includeRevoked:
            query.includeRevoked === '1' || query.includeRevoked === 'true',
        }),
      )
      .catch(fail);
  }

  listInvites(
    authorization: string | undefined,
    tenantId: string,
    query: { cursor?: string; limit?: string; state?: string },
  ) {
    const limit = query.limit ? Number(query.limit) : undefined;
    const state = query.state as PortalInviteState | undefined;
    return this.selfActor(authorization)
      .then((u) =>
        listPortalInvites(this.deps.db!, {
          tenantId,
          actorUserId: u.userId,
          cursor: query.cursor,
          limit: Number.isFinite(limit) ? limit : undefined,
          state,
        }),
      )
      .catch(fail);
  }

  changeRole(
    authorization: string | undefined,
    tenantId: string,
    membershipId: string,
    body: { role: string; reason: string },
  ) {
    if (!isMembershipRole(body.role)) {
      return Promise.reject(
        new PlatformError(PLATFORM_ERROR_CODES.INVALID_INPUT, 'Invalid role'),
      ).catch(fail);
    }
    const role = body.role;
    return this.selfActor(authorization)
      .then((u) =>
        changePortalMemberRole(this.deps.db!, {
          tenantId,
          actorUserId: u.userId,
          membershipId,
          role,
          reason: body.reason,
        }),
      )
      .catch(fail);
  }

  putAssignment(
    authorization: string | undefined,
    tenantId: string,
    membershipId: string,
    eventId: string,
    body: { role: string; reason: string },
  ) {
    if (!isMembershipRole(body.role)) {
      return Promise.reject(
        new PlatformError(PLATFORM_ERROR_CODES.INVALID_INPUT, 'Invalid role'),
      ).catch(fail);
    }
    const role = body.role;
    return this.selfActor(authorization)
      .then((u) =>
        putPortalEventAssignment(this.deps.db!, {
          tenantId,
          actorUserId: u.userId,
          membershipId,
          eventId,
          role,
          reason: body.reason,
        }),
      )
      .catch(fail);
  }

  deleteAssignment(
    authorization: string | undefined,
    tenantId: string,
    membershipId: string,
    eventId: string,
    body: { reason: string },
  ) {
    return this.selfActor(authorization)
      .then((u) =>
        deletePortalEventAssignment(this.deps.db!, {
          tenantId,
          actorUserId: u.userId,
          membershipId,
          eventId,
          reason: body.reason,
        }),
      )
      .catch(fail);
  }

  revokeInvite(
    authorization: string | undefined,
    tenantId: string,
    inviteId: string,
    body: { reason: string },
  ) {
    return this.selfActor(authorization)
      .then((u) =>
        revokePortalInvite(this.deps.db!, {
          tenantId,
          actorUserId: u.userId,
          inviteId,
          reason: body.reason,
        }),
      )
      .catch(fail);
  }

  resendInvite(
    authorization: string | undefined,
    tenantId: string,
    inviteId: string,
    body: { reason: string },
  ) {
    return this.selfActor(authorization)
      .then((u) =>
        resendPortalInvite(this.deps.db!, this.deps.security!, {
          tenantId,
          actorUserId: u.userId,
          inviteId,
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

  @Get('platform/audit')
  @ApiBearerAuth()
  @ApiOkResponse({ type: PortalPlatformAuditPageDto })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  listAudit(
    @Headers('authorization') authorization: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('action') action?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.platform.listAudit(authorization, {
      cursor,
      limit,
      from,
      to,
      action,
      tenantId,
    });
  }

  @Get('platform/tenants')
  @ApiBearerAuth()
  @ApiOkResponse({ type: PortalPlatformTenantsPageDto })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listTenants(
    @Headers('authorization') authorization: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.platform.listTenants(authorization, { cursor, limit });
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

  @Get('tenants/:tenantId/members')
  @ApiBearerAuth()
  @ApiOkResponse({ type: PortalMembersPageDto })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'includeRevoked', required: false })
  listMembers(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('includeRevoked') includeRevoked?: string,
  ) {
    return this.platform.listMembers(authorization, tenantId, {
      cursor,
      limit,
      includeRevoked,
    });
  }

  @Get('tenants/:tenantId/invites')
  @ApiBearerAuth()
  @ApiOkResponse({ type: PortalInvitesPageDto })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'state', required: false, enum: ['PENDING', 'USED', 'REVOKED', 'EXPIRED'] })
  listInvites(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('state') state?: string,
  ) {
    return this.platform.listInvites(authorization, tenantId, {
      cursor,
      limit,
      state,
    });
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

  @Patch('tenants/:tenantId/members/:membershipId/role')
  @ApiBearerAuth()
  @ApiBody({ type: PortalMemberRoleBodyDto })
  @ApiOkResponse({ type: PortalMembershipMutationResponseDto })
  changeRole(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: PortalMemberRoleBodyDto,
  ) {
    return this.platform.changeRole(
      authorization,
      tenantId,
      membershipId,
      body,
    );
  }

  @Put('tenants/:tenantId/members/:membershipId/event-assignments/:eventId')
  @ApiBearerAuth()
  @ApiBody({ type: PortalAssignmentBodyDto })
  @ApiOkResponse({ type: PortalMembershipMutationResponseDto })
  putAssignment(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('membershipId') membershipId: string,
    @Param('eventId') eventId: string,
    @Body() body: PortalAssignmentBodyDto,
  ) {
    return this.platform.putAssignment(
      authorization,
      tenantId,
      membershipId,
      eventId,
      body,
    );
  }

  @Delete('tenants/:tenantId/members/:membershipId/event-assignments/:eventId')
  @ApiBearerAuth()
  @ApiBody({ type: PortalReasonBodyDto })
  @ApiOkResponse({ type: PortalMembershipMutationResponseDto })
  deleteAssignment(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('membershipId') membershipId: string,
    @Param('eventId') eventId: string,
    @Body() body: PortalReasonBodyDto,
  ) {
    return this.platform.deleteAssignment(
      authorization,
      tenantId,
      membershipId,
      eventId,
      body,
    );
  }

  @Post('tenants/:tenantId/members/:membershipId/revoke')
  @ApiBearerAuth()
  @ApiBody({ type: PortalReasonBodyDto })
  revokeMember(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: PortalReasonBodyDto,
  ) {
    return this.platform.revokeMember(
      authorization,
      tenantId,
      membershipId,
      body,
    );
  }

  @Post('tenants/:tenantId/invites/:inviteId/revoke')
  @ApiBearerAuth()
  @ApiBody({ type: PortalReasonBodyDto })
  @ApiOkResponse({ type: PortalInviteRevokeResponseDto })
  revokeInvite(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('inviteId') inviteId: string,
    @Body() body: PortalReasonBodyDto,
  ) {
    return this.platform.revokeInvite(
      authorization,
      tenantId,
      inviteId,
      body,
    );
  }

  @Post('tenants/:tenantId/invites/:inviteId/resend')
  @ApiBearerAuth()
  @ApiBody({ type: PortalReasonBodyDto })
  @ApiOkResponse({ type: PortalInviteResendResponseDto })
  resendInvite(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('inviteId') inviteId: string,
    @Body() body: PortalReasonBodyDto,
  ) {
    return this.platform.resendInvite(
      authorization,
      tenantId,
      inviteId,
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
