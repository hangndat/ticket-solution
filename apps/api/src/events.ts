import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Injectable,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import {
  type ApiError,
  type ArchiveEventBody,
  type CancelEventBody,
  type CloneEventBody,
  type CreateEventBodyV2,
  type EventImpactPreviewRequest,
  type PatchEventBody,
} from '@ticket/contracts';
import {
  AuthzError,
  EventAdminError,
  EVENT_ADMIN_ERROR_CODES,
  EventError,
  EVENT_ERROR_CODES,
  IdentityError,
  IDENTITY_ERROR_CODES,
  archiveEvent,
  cancelEvent,
  cloneEvent,
  createEvent,
  createIssuanceSource,
  createTicketType,
  getEvent,
  listEvents,
  previewEventImpact,
  updateEvent,
  withTenant,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class CreateEventBodyDto implements CreateEventBodyV2 {
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false }) timezone?: string;
  @ApiProperty({ required: false, enum: ['PUBLIC', 'UNLISTED'] })
  visibility?: 'PUBLIC' | 'UNLISTED';
  @ApiProperty({ required: false, nullable: true, type: String })
  startsAt?: string | null;
  @ApiProperty({ required: false, nullable: true, type: String })
  endsAt?: string | null;
  @ApiProperty({ required: false, nullable: true, type: Object })
  venue?: { name: string; address: string } | null;
  @ApiProperty({ required: false, nullable: true, type: Object })
  contact?: { email?: string; phone?: string; url?: string } | null;
  @ApiProperty({ required: false, nullable: true, type: String })
  redemptionOpensAt?: string | null;
  @ApiProperty({ required: false, nullable: true, type: String })
  redemptionClosesAt?: string | null;
  @ApiProperty({ required: false, nullable: true, type: String })
  checkInOpensAt?: string | null;
  @ApiProperty({ required: false, nullable: true, type: String })
  checkInClosesAt?: string | null;
  @ApiProperty({ required: false, nullable: true, type: Number })
  maxTicketsPerAttendee?: number | null;
}

class PatchEventBodyDto implements PatchEventBody {
  @ApiProperty() expectedRevision!: number;
  @ApiProperty({ required: false }) name?: string;
  @ApiProperty({ required: false }) timezone?: string;
  @ApiProperty({ required: false, enum: ['PUBLIC', 'UNLISTED'] })
  visibility?: 'PUBLIC' | 'UNLISTED';
  @ApiProperty({ required: false, nullable: true, type: String })
  startsAt?: string | null;
  @ApiProperty({ required: false, nullable: true, type: String })
  endsAt?: string | null;
  @ApiProperty({ required: false, nullable: true, type: Object })
  venue?: { name: string; address: string } | null;
  @ApiProperty({ required: false, nullable: true, type: Object })
  contact?: { email?: string; phone?: string; url?: string } | null;
  @ApiProperty({ required: false, nullable: true, type: String })
  redemptionOpensAt?: string | null;
  @ApiProperty({ required: false, nullable: true, type: String })
  redemptionClosesAt?: string | null;
  @ApiProperty({ required: false, nullable: true, type: String })
  checkInOpensAt?: string | null;
  @ApiProperty({ required: false, nullable: true, type: String })
  checkInClosesAt?: string | null;
  @ApiProperty({ required: false, nullable: true, type: Number })
  maxTicketsPerAttendee?: number | null;
  @ApiProperty({ required: false, enum: [true] })
  confirmIssuedImpact?: true;
  @ApiProperty({ required: false }) notifyAttendees?: boolean;
}

class CloneEventBodyDto implements CloneEventBody {
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false }) copyConfig?: boolean;
}

class CancelEventBodyDto implements CancelEventBody {
  @ApiProperty() expectedRevision!: number;
  @ApiProperty() reason!: string;
  @ApiProperty({ required: false }) notifyAttendees?: boolean;
}

class ArchiveEventBodyDto implements ArchiveEventBody {
  @ApiProperty() expectedRevision!: number;
}

class ImpactPreviewBodyDto implements EventImpactPreviewRequest {
  @ApiProperty() expectedRevision!: number;
  @ApiProperty({ required: false, nullable: true, type: String })
  startsAt?: string | null;
  @ApiProperty({ required: false, nullable: true, type: String })
  endsAt?: string | null;
  @ApiProperty({ required: false, nullable: true, type: Object })
  venue?: { name: string; address: string } | null;
}


class CreateTicketTypeBodyDto {
  @ApiProperty() label!: string;
  @ApiProperty({ required: false })
  entitlementSnapshot?: Record<string, unknown>;
}

class TicketTypeCreatedDto {
  @ApiProperty({ format: 'uuid' }) ticketTypeId!: string;
  @ApiProperty() label!: string;
}

class CreateSourceBodyDto {
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['AUTO', 'MANUAL'] }) approvalMode!: 'AUTO' | 'MANUAL';
  @ApiProperty({ format: 'uuid' }) ticketTypeId!: string;
}

class SourceCreatedDto {
  @ApiProperty({ format: 'uuid' }) sourceId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['AUTO', 'MANUAL'] }) approvalMode!: 'AUTO' | 'MANUAL';
  @ApiProperty({ format: 'uuid' }) ticketTypeId!: string;
}

type Deps = {
  db: PrismaClient | null;
  verifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  bootError: IdentityError | null;
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

function eventHttpStatus(code: string): number {
  if (code === EVENT_ERROR_CODES.EVENT_NOT_FOUND) return 404;
  if (
    code === EVENT_ERROR_CODES.REVISION_CONFLICT ||
    code === EVENT_ERROR_CODES.SLUG_TAKEN ||
    code === EVENT_ERROR_CODES.IDEMPOTENCY_CONFLICT ||
    code === EVENT_ERROR_CODES.IMPACT_CONFIRM_REQUIRED
  ) {
    return 409;
  }
  if (code === EVENT_ERROR_CODES.RETRYABLE_CONFLICT) return 409;
  if (code === EVENT_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED) return 400;
  return 422;
}

@Injectable()
export class EventAdminService {
  constructor(private readonly deps: Deps) {}

  private async actor(authorization: string | undefined) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.db || !this.deps.verifier || !this.deps.users) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Event services are not configured',
      );
    }
    const verified = await this.deps.verifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity(verified);
  }

  async create(
    authorization: string | undefined,
    tenantId: string,
    body: CreateEventBodyV2,
    idempotencyKey: string | undefined,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      createEvent(tx, {
        tenantId,
        actorUserId: user.userId,
        idempotencyKey: idempotencyKey ?? '',
        body,
      }),
    );
  }

  async list(
    authorization: string | undefined,
    tenantId: string,
    cursor?: string,
    limit?: number,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      listEvents(tx, {
        tenantId,
        actorUserId: user.userId,
        cursor,
        limit,
      }),
    );
  }

  async get(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      getEvent(tx, { tenantId, eventId, actorUserId: user.userId }),
    );
  }

  async patch(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: PatchEventBody,
    idempotencyKey: string | undefined,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      updateEvent(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        idempotencyKey: idempotencyKey ?? '',
        body,
      }),
    );
  }

  async clone(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: CloneEventBody,
    idempotencyKey: string | undefined,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      cloneEvent(tx, {
        tenantId,
        sourceEventId: eventId,
        actorUserId: user.userId,
        idempotencyKey: idempotencyKey ?? '',
        body,
      }),
    );
  }

  async archive(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: ArchiveEventBody,
    idempotencyKey: string | undefined,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      archiveEvent(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        idempotencyKey: idempotencyKey ?? '',
        body,
      }),
    );
  }

  async cancel(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: CancelEventBody,
    idempotencyKey: string | undefined,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      cancelEvent(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        idempotencyKey: idempotencyKey ?? '',
        body,
      }),
    );
  }

  async impactPreview(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: EventImpactPreviewRequest,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      previewEventImpact(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        body,
      }),
    );
  }

  async ticketType(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: CreateTicketTypeBodyDto,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      createTicketType(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        label: body.label,
        entitlementSnapshot: body.entitlementSnapshot,
      }),
    );
  }

  async source(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: CreateSourceBodyDto,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      createIssuanceSource(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        name: body.name,
        approvalMode: body.approvalMode,
        ticketTypeId: body.ticketTypeId,
      }),
    );
  }
}

@ApiTags('events')
@Controller()
export class EventAdminController {
  constructor(private readonly events: EventAdminService) {}

  private fail(error: unknown): never {
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
    if (error instanceof EventAdminError) {
      const status =
        error.code === EVENT_ADMIN_ERROR_CODES.EVENT_NOT_FOUND
          ? 404
          : error.code === EVENT_ADMIN_ERROR_CODES.SLUG_TAKEN
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
    if (error instanceof EventError) {
      throw new HttpException(
        {
          code: error.code,
          message: error.message,
          requestId: randomUUID(),
          retryable: error.retryable,
        } satisfies ApiError,
        eventHttpStatus(error.code),
      );
    }
    throw error;
  }

  @Post('tenants/:tenantId/events')
  @ApiBearerAuth()
  create(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('tenantId') tenantId: string,
    @Body() body: CreateEventBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    return this.events
      .create(authorization, tenant, body, idempotencyKey)
      .catch((error) => this.fail(error));
  }

  @Get('tenants/:tenantId/events')
  @ApiBearerAuth()
  list(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.events
      .list(authorization, tenant, cursor, parsedLimit)
      .catch((error) => this.fail(error));
  }

  @Get('tenants/:tenantId/events/:eventId')
  @ApiBearerAuth()
  get(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.events
      .get(authorization, tenant, event)
      .catch((error) => this.fail(error));
  }

  @Patch('tenants/:tenantId/events/:eventId')
  @ApiBearerAuth()
  patch(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: PatchEventBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.events
      .patch(authorization, tenant, event, body, idempotencyKey)
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/clone')
  @ApiBearerAuth()
  clone(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: CloneEventBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.events
      .clone(authorization, tenant, event, body, idempotencyKey)
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/archive')
  @ApiBearerAuth()
  archive(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: ArchiveEventBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.events
      .archive(authorization, tenant, event, body, idempotencyKey)
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/cancel')
  @ApiBearerAuth()
  cancel(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: CancelEventBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.events
      .cancel(authorization, tenant, event, body, idempotencyKey)
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/impact-preview')
  @ApiBearerAuth()
  impactPreview(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: ImpactPreviewBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.events
      .impactPreview(authorization, tenant, event, body)
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/ticket-types')
  @ApiBearerAuth()
  @ApiOkResponse({ type: TicketTypeCreatedDto })
  ticketType(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: CreateTicketTypeBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.events
      .ticketType(authorization, tenant, event, body)
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/sources')
  @ApiBearerAuth()
  @ApiOkResponse({ type: SourceCreatedDto })
  source(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: CreateSourceBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.events
      .source(authorization, tenant, event, body)
      .catch((error) => this.fail(error));
  }
}
