import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpException,
  Injectable,
  Logger,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { type ApiError, type InvitationListQuery } from '@ticket/contracts';
import {
  AuthzError,
  IdentityError,
  IDENTITY_ERROR_CODES,
  ImportError,
  IMPORT_ERROR_CODES,
  importErrorHttpStatus,
  InventoryError,
  INVENTORY_ERROR_CODES,
  claimGuestInvitation,
  dispatchGuestInvitations,
  listGuestInvitations,
  previewInvitationDispatch,
  type CodeHmacConfig,
  type CredentialKeyInput,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';
import { identityErrorHttpStatus } from './identity-http-status';
import { API_RATE_BUCKETS, API_RATE_LIMITS } from './http-limits';
import {
  consumeUserRateLimitWithRetryAfter,
  RateLimitedWithRetryAfter,
} from './http-rate-limit';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class InvitationDispatchPreviewBodyDto {
  @ApiProperty({ type: [String] }) invitationIds!: string[];
}

class InvitationDispatchBodyDto {
  @ApiProperty({ type: [String] }) invitationIds!: string[];
  @ApiProperty() previewRevision!: number;
}

class InvitationClaimBodyDto {
  @ApiProperty() token!: string;
  @ApiProperty({ required: false }) formVersion?: string;
  @ApiProperty({ required: false }) termsVersion?: string;
  @ApiProperty({ required: false }) answers?: Record<string, string | boolean>;
  @ApiProperty({ required: false }) termsAccepted?: true;
}

class InvitationSummaryDto {
  @ApiProperty({ format: 'uuid' }) invitationId!: string;
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ format: 'uuid' }) sourceId!: string;
  @ApiProperty({ format: 'uuid' }) ticketTypeId!: string;
  @ApiProperty() invitedEmailMasked!: string;
  @ApiProperty({
    enum: ['PENDING', 'DISPATCHED', 'CLAIMED', 'EXPIRED', 'REVOKED'],
  })
  state!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}

class InvitationListPageDto {
  @ApiProperty({ type: [InvitationSummaryDto] }) items!: InvitationSummaryDto[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
}

/** Validate the original URL before Nest can collapse repeated query keys. */
export function parseInvitationListQuery(rawUrl: string): InvitationListQuery {
  const params = new URL(rawUrl, 'http://localhost').searchParams;
  const allowed = new Set(['cursor', 'limit', 'state', 'q']);
  for (const [key, value] of params) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) {
      throw new ImportError(
        IMPORT_ERROR_CODES.INVALID_FILTER,
        'Invalid invitation list query',
      );
    }
    if (value === '' && key !== 'cursor') {
      throw new ImportError(
        IMPORT_ERROR_CODES.INVALID_FILTER,
        'Invalid invitation list query',
      );
    }
  }
  const q = params.get('q');
  const cursor = params.get('cursor');
  if (q !== null && cursor !== null) {
    throw new ImportError(
      IMPORT_ERROR_CODES.INVALID_CURSOR,
      'Cursor cannot be used with q',
    );
  }
  if (cursor !== null && !UUID.test(cursor)) {
    throw new ImportError(
      IMPORT_ERROR_CODES.INVALID_CURSOR,
      'Invalid invitation list cursor',
    );
  }
  if (q !== null && !UUID.test(q)) {
    throw new ImportError(
      IMPORT_ERROR_CODES.INVALID_FILTER,
      'q must be an invitation UUID',
    );
  }
  const rawLimit = params.get('limit');
  let limit: number | undefined;
  if (rawLimit !== null) {
    if (!/^[1-9][0-9]*$/.test(rawLimit) || Number(rawLimit) > 100) {
      throw new ImportError(
        IMPORT_ERROR_CODES.INVALID_FILTER,
        'Invalid invitation list limit',
      );
    }
    limit = Number(rawLimit);
  }
  const rawState = params.get('state');
  if (
    rawState !== null &&
    !['PENDING', 'DISPATCHED', 'CLAIMED', 'EXPIRED', 'REVOKED'].includes(
      rawState,
    )
  ) {
    throw new ImportError(
      IMPORT_ERROR_CODES.INVALID_FILTER,
      'Invalid invitation list state',
    );
  }
  const state = rawState as InvitationListQuery['state'] | null;
  return q !== null
    ? { q, limit, state: state ?? undefined }
    : { cursor: cursor ?? undefined, limit, state: state ?? undefined };
}

type Deps = {
  db: PrismaClient | null;
  verifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  bootError: IdentityError | null;
  hmac: CodeHmacConfig | null;
  credentialKey: CredentialKeyInput | null;
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
  const trimmed = value?.trim() ?? '';
  if (!UUID.test(trimmed)) throw scopeError(`${name} must be a UUID`);
  return trimmed;
}

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);
  constructor(private readonly deps: Deps) {}

  private async actor(authorization: string | undefined) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (
      !this.deps.db ||
      !this.deps.verifier ||
      !this.deps.users ||
      !this.deps.hmac
    ) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Inventory services are not configured',
      );
    }
    const verified = await this.deps.verifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity(verified);
  }

  async listInvitations(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    query: InvitationListQuery,
    requestId: string | undefined,
  ) {
    const user = await this.actor(authorization);
    await consumeUserRateLimitWithRetryAfter(
      this.deps.db!,
      user.userId,
      API_RATE_BUCKETS.invitationsList,
      API_RATE_LIMITS.invitationsListPerUser,
    );
    const page = await listGuestInvitations(this.deps.db!, {
      tenantId,
      eventId,
      actorUserId: user.userId,
      ...query,
    });
    this.logger.log(
      JSON.stringify({
        action: 'guest_invitations.list',
        requestId,
        actorUserId: user.userId,
        tenantId,
        eventId,
        filteredById: query.q !== undefined,
        state: query.state ?? null,
        count: page.items.length,
      }),
    );
    return page;
  }

  async dispatchPreview(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: InvitationDispatchPreviewBodyDto,
  ) {
    const user = await this.actor(authorization);
    return previewInvitationDispatch(this.deps.db!, {
      tenantId,
      eventId,
      actorUserId: user.userId,
      body,
    });
  }

  async dispatch(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: InvitationDispatchBodyDto,
    idempotencyKey: string | undefined,
  ) {
    const user = await this.actor(authorization);
    return dispatchGuestInvitations(this.deps.db!, {
      tenantId,
      eventId,
      actorUserId: user.userId,
      body,
      idempotencyKey: idempotencyKey ?? '',
    });
  }

  async claim(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: InvitationClaimBodyDto,
    idempotencyKey: string | undefined,
  ) {
    const user = await this.actor(authorization);
    if (!this.deps.credentialKey) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Credential key is not configured',
      );
    }
    const outcome = await claimGuestInvitation(
      this.deps.db!,
      this.deps.hmac!,
      this.deps.credentialKey,
      {
        tenantId,
        eventId,
        actorUserId: user.userId,
        actorEmail: user.email,
        emailVerified: user.emailVerified,
        body,
        idempotencyKey: idempotencyKey ?? '',
      },
    );
    if (outcome.ok === true) return outcome.result;
    if (outcome.ok === 'pending') return outcome.result;
    throw new ImportError(
      IMPORT_ERROR_CODES.INVITATION_TOKEN_INVALID,
      outcome.rejection.message,
      422,
    );
  }
}

@ApiTags('inventory')
@Controller()
export class InvitationController {
  constructor(private readonly invitations: InvitationService) {}

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
    if (error instanceof ImportError) {
      throw new HttpException(
        {
          code: error.code,
          message: error.message,
          requestId: randomUUID(),
          retryable: false,
        } satisfies ApiError,
        error.httpStatus || importErrorHttpStatus(error.code),
      );
    }
    if (error instanceof InventoryError) {
      const status =
        error.code === INVENTORY_ERROR_CODES.EVENT_NOT_FOUND
          ? 404
          : error.code === INVENTORY_ERROR_CODES.CODE_DUPLICATE
            ? 409
            : 422;
      throw new HttpException(
        {
          code: error.code,
          message: error.message,
          requestId: randomUUID(),
          retryable: false,
        } satisfies ApiError,
        status,
      );
    }
    throw error;
  }

  @Get('tenants/:tenantId/events/:eventId/invitations')
  @ApiBearerAuth()
  @ApiQuery({ name: 'cursor', required: false, type: String, format: 'uuid' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @ApiQuery({
    name: 'state',
    required: false,
    enum: ['PENDING', 'DISPATCHED', 'CLAIMED', 'EXPIRED', 'REVOKED'],
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    format: 'uuid',
    description: 'Exact invitationId',
  })
  @ApiOkResponse({ type: InvitationListPageDto })
  @Header('Cache-Control', 'private, no-store')
  listInvitations(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Req() req: { id?: string; raw: { url?: string } },
    @Res({ passthrough: true })
    reply: { header: (name: string, value: string) => void },
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    try {
      const query = parseInvitationListQuery(req.raw.url ?? '');
      return this.invitations
        .listInvitations(authorization, tenant, event, query, req.id)
        .catch((error) => {
          if (error instanceof RateLimitedWithRetryAfter) {
            reply.header('Retry-After', String(error.retryAfterSeconds));
          }
          this.fail(error);
        });
    } catch (error) {
      this.fail(error);
    }
  }

  @Post('tenants/:tenantId/events/:eventId/invitations/dispatch-preview')
  @ApiBearerAuth()
  dispatchPreview(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: InvitationDispatchPreviewBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.invitations
      .dispatchPreview(authorization, tenant, event, body)
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/invitations/dispatch')
  @ApiBearerAuth()
  dispatch(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: InvitationDispatchBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.invitations
      .dispatch(authorization, tenant, event, body, idempotencyKey)
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/invitations/claim')
  @ApiBearerAuth()
  claim(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: InvitationClaimBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.invitations
      .claim(authorization, tenant, event, body, idempotencyKey)
      .catch((error) => this.fail(error));
  }
}
