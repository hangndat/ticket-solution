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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { type ApiError } from '@ticket/contracts';
import {
  ApprovalError,
  APPROVAL_ERROR_CODES,
  AuthzError,
  IdentityError,
  IDENTITY_ERROR_CODES,
  decideRedemption,
  configureIssuanceLockTimeout,
  isRetryableTransactionConflict,
  listStaffPendingRedemptions,
  unwrapApprovalOutcome,
  withTenant,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
  type GateCredentialConfig,
} from '@ticket/backend';
import { identityErrorHttpStatus } from './identity-http-status';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class DenyBodyDto {
  @ApiProperty({ required: false })
  reason?: string;
}

class ApprovalResponseDto {
  @ApiProperty({ enum: ['approve', 'deny'] }) decision!: 'approve' | 'deny';
  @ApiProperty() requestId!: string;
  @ApiProperty({ enum: ['ISSUED', 'REJECTED'] }) status!: 'ISSUED' | 'REJECTED';
  @ApiProperty({ nullable: true, type: String }) ticketId!: string | null;
  @ApiProperty() operationId!: string;
  @ApiProperty() ownerUserId!: string;
  @ApiProperty() replayed!: boolean;
}

type Deps = {
  db: PrismaClient | null;
  verifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  bootError: IdentityError | null;
  credentialKey: string | null;
  gateCredentialConfig?: GateCredentialConfig | null;
};

function scopeError(message: string): HttpException {
  return new HttpException(
    {
      code: 'SCOPE_REQUIRED',
      message,
      requestId: randomUUID(),
      retryable: false,
    } satisfies ApiError,
    422,
  );
}

function requireUuid(value: string | undefined, name: string): string {
  if (!value || !UUID.test(value)) throw scopeError(`${name} must be a UUID`);
  return value;
}

@Injectable()
export class ApprovalService {
  constructor(private readonly deps: Deps) {}

  private async actor(authorization: string | undefined) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.db || !this.deps.verifier || !this.deps.users) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Approval services are not configured',
      );
    }
    if (!this.deps.credentialKey) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Ticket credential encryption is not configured',
      );
    }
    const verified = await this.deps.verifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity(verified);
  }

  async decide(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    requestId: string,
    idempotencyKey: string | undefined,
    decision: 'approve' | 'deny',
    reason?: string | null,
  ) {
    const user = await this.actor(authorization);
    let outcome;
    try {
      outcome = await withTenant(this.deps.db!, tenantId, async (tx) => {
        await configureIssuanceLockTimeout(tx);
        return decideRedemption(tx, this.deps.credentialKey!, {
          tenantId,
          eventId,
          requestId,
          actorUserId: user.userId,
          decision,
          idempotencyKey: idempotencyKey ?? '',
          reason: reason ?? null,
          manualCodePepper: this.deps.gateCredentialConfig?.manualCodePepper,
        });
      });
    } catch (error) {
      if (isRetryableTransactionConflict(error)) {
        throw new ApprovalError(
          APPROVAL_ERROR_CODES.RETRYABLE_CONFLICT,
          'Approval transaction conflicted; retry with the same key',
          true,
        );
      }
      throw error;
    }
    return unwrapApprovalOutcome(outcome);
  }

  async listPending(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    cursor?: string,
    limit?: number,
    sourceId?: string,
    ticketTypeId?: string,
    q?: string,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      listStaffPendingRedemptions(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        cursor,
        limit,
        sourceId,
        ticketTypeId,
        q,
      }),
    );
  }
}

@ApiTags('redemptions')
@Controller()
export class ApprovalController {
  constructor(private readonly approvals: ApprovalService) {}

  private fail(error: unknown): never {
    if (error instanceof IdentityError) {
      throw new HttpException(
        {
          code: error.code,
          message: error.message,
          requestId: randomUUID(),
          retryable: error.retryable,
        } satisfies ApiError,
        identityErrorHttpStatus(error.code),
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
    if (error instanceof ApprovalError) {
      const status =
        error.code === APPROVAL_ERROR_CODES.REQUEST_NOT_FOUND
          ? 404
          : error.code === APPROVAL_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED ||
              error.code === APPROVAL_ERROR_CODES.REASON_REQUIRED ||
              error.code === APPROVAL_ERROR_CODES.REASON_TOO_LONG
            ? 422
            : error.code === APPROVAL_ERROR_CODES.RETRYABLE_CONFLICT
              ? 503
              : error.code === APPROVAL_ERROR_CODES.PENDING_EXPIRED
                ? 409
                : 409;
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
    throw error;
  }

  @Get('tenants/:tenantId/events/:eventId/redemptions')
  @ApiBearerAuth()
  listPending(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
    @Query('sourceId') sourceId?: string,
    @Query('ticketTypeId') ticketTypeId?: string,
    @Query('q') q?: string,
  ) {
    if (status && status !== 'PENDING_REVIEW') {
      throw scopeError('status must be PENDING_REVIEW when provided');
    }
    const limit =
      limitRaw != null && limitRaw !== ''
        ? Number(limitRaw)
        : undefined;
    if (limit != null && (!Number.isFinite(limit) || limit < 1)) {
      throw scopeError('limit must be a positive integer');
    }
    const source =
      sourceId != null && sourceId !== ''
        ? requireUuid(sourceId, 'sourceId')
        : undefined;
    const ticketType =
      ticketTypeId != null && ticketTypeId !== ''
        ? requireUuid(ticketTypeId, 'ticketTypeId')
        : undefined;
    const requestQ =
      q != null && q !== '' ? requireUuid(q, 'q') : undefined;
    return this.approvals
      .listPending(
        authorization,
        requireUuid(tenantId, 'tenantId'),
        requireUuid(eventId, 'eventId'),
        cursor,
        limit,
        source,
        ticketType,
        requestQ,
      )
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/redemptions/:requestId/approve')
  @ApiBearerAuth()
  @ApiHeader({ name: 'idempotency-key', required: true })
  @ApiOkResponse({ type: ApprovalResponseDto })
  approve(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.approvals
      .decide(
        authorization,
        requireUuid(tenantId, 'tenantId'),
        requireUuid(eventId, 'eventId'),
        requireUuid(requestId, 'requestId'),
        idempotencyKey,
        'approve',
        null,
      )
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/redemptions/:requestId/deny')
  @ApiBearerAuth()
  @ApiHeader({ name: 'idempotency-key', required: true })
  @ApiOkResponse({ type: ApprovalResponseDto })
  deny(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Param('requestId') requestId: string,
    @Body() body: DenyBodyDto,
  ) {
    if (body?.reason != null && typeof body.reason !== 'string') {
      throw scopeError('reason must be a string');
    }
    return this.approvals
      .decide(
        authorization,
        requireUuid(tenantId, 'tenantId'),
        requireUuid(eventId, 'eventId'),
        requireUuid(requestId, 'requestId'),
        idempotencyKey,
        'deny',
        body?.reason ?? null,
      )
      .catch((error) => this.fail(error));
  }
}
