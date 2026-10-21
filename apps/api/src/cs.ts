import { randomUUID } from 'node:crypto';
import {
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
  AuthzError,
  CsError,
  CS_ERROR_CODES,
  IdentityError,
  IDENTITY_ERROR_CODES,
  getCsTicket,
  listCsTickets,
  resendTicketEmail,
  withTenant,
  type CodeHmacConfig,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';
import { identityErrorHttpStatus } from './identity-http-status';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class CsNotificationDto {
  @ApiProperty() channel!: string;
  @ApiProperty() state!: string;
  @ApiProperty({ enum: ['PENDING', 'ACCEPTED', 'FAILED', 'DEAD'] })
  providerStatus!: string;
  @ApiProperty({ nullable: true, type: String }) providerRef!: string | null;
  @ApiProperty() attempts!: number;
  @ApiProperty({ nullable: true, type: String, description: 'Always null' })
  lastError!: null;
}

class CsTicketSummaryDto {
  @ApiProperty({ format: 'uuid' }) ticketId!: string;
  @ApiProperty() state!: string;
  @ApiProperty({ format: 'uuid' }) ticketTypeId!: string;
  @ApiProperty({ format: 'uuid' }) sourceId!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ nullable: true, type: String }) ownerEmailMasked!: string | null;
  @ApiProperty({ nullable: true, type: String }) lastCheckInAt!: string | null;
  @ApiProperty({ nullable: true, type: CsNotificationDto })
  notification!: CsNotificationDto | null;
}

class CsTicketListDto {
  @ApiProperty({ type: [CsTicketSummaryDto] }) items!: CsTicketSummaryDto[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
}

class CsTimelineItemDto {
  @ApiProperty() at!: string;
  @ApiProperty() kind!: string;
  @ApiProperty() summary!: string;
}

class CsTicketDetailDto extends CsTicketSummaryDto {
  @ApiProperty({ type: [CsTimelineItemDto] }) timeline!: CsTimelineItemDto[];
}

class CsResendDto {
  @ApiProperty({ format: 'uuid' }) operationId!: string;
  @ApiProperty({ format: 'uuid' }) notificationId!: string;
  @ApiProperty({ enum: ['PENDING'] }) providerStatus!: 'PENDING';
  @ApiProperty() replayed!: boolean;
}

type Deps = {
  db: PrismaClient | null;
  verifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  bootError: IdentityError | null;
  hmac: CodeHmacConfig | null;
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
export class CsService {
  constructor(private readonly deps: Deps) {}

  private async actor(authorization: string | undefined) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.verifier || !this.deps.users || !this.deps.db || !this.deps.hmac) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'CS services are not configured',
      );
    }
    const verified = await this.deps.verifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity(verified);
  }

  async list(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    q?: string,
    limit?: string,
    cursor?: string,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      listCsTickets(tx, this.deps.hmac!, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        q,
        limit: limit ? Number(limit) : undefined,
        cursor,
      }),
    );
  }

  async detail(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    ticketId: string,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      getCsTicket(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        ticketId,
      }),
    );
  }

  async resend(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    ticketId: string,
    idempotencyKey: string | undefined,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      resendTicketEmail(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        ticketId,
        clientKey: idempotencyKey ?? '',
      }),
    );
  }
}

@ApiTags('cs')
@Controller()
export class CsController {
  constructor(private readonly cs: CsService) {}

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
    if (error instanceof CsError) {
      const status =
        error.code === CS_ERROR_CODES.TICKET_NOT_FOUND ||
        error.code === CS_ERROR_CODES.EVENT_NOT_FOUND
          ? 404
          : error.code === CS_ERROR_CODES.RESEND_COOLDOWN ||
              error.code === CS_ERROR_CODES.RESEND_LIMIT
            ? 429
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

  @Get('tenants/:tenantId/events/:eventId/tickets')
  @ApiBearerAuth()
  @ApiOkResponse({ type: CsTicketListDto })
  list(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.cs
      .list(
        authorization,
        requireUuid(tenantId, 'tenantId'),
        requireUuid(eventId, 'eventId'),
        q,
        limit,
        cursor,
      )
      .catch((e) => this.fail(e));
  }

  @Get('tenants/:tenantId/events/:eventId/tickets/:ticketId')
  @ApiBearerAuth()
  @ApiOkResponse({ type: CsTicketDetailDto })
  detail(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Param('ticketId') ticketId: string,
  ) {
    return this.cs
      .detail(
        authorization,
        requireUuid(tenantId, 'tenantId'),
        requireUuid(eventId, 'eventId'),
        requireUuid(ticketId, 'ticketId'),
      )
      .catch((e) => this.fail(e));
  }

  @Post('tenants/:tenantId/events/:eventId/tickets/:ticketId/resend')
  @ApiBearerAuth()
  @ApiHeader({ name: 'idempotency-key', required: true })
  @ApiOkResponse({ type: CsResendDto })
  resend(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Param('ticketId') ticketId: string,
  ) {
    return this.cs
      .resend(
        authorization,
        requireUuid(tenantId, 'tenantId'),
        requireUuid(eventId, 'eventId'),
        requireUuid(ticketId, 'ticketId'),
        idempotencyKey,
      )
      .catch((e) => this.fail(e));
  }
}
