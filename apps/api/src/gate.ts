import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpException,
  Injectable,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProperty,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  OFFLINE_SYNC_ERROR_CODES,
  OFFLINE_SYNC_EVENT_TYPES,
  OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS,
  OFFLINE_SYNC_PAYLOAD_VERSION,
  type ApiError,
  type OfflineSyncReceiptResponse,
  type OfflineSyncResponse,
} from '@ticket/contracts';
import {
  AuthzError,
  EventError,
  EVENT_ERROR_CODES,
  GateError,
  GATE_ERROR_CODES,
  IdentityError,
  IDENTITY_ERROR_CODES,
  confirmCheckin,
  applyOfflineSyncBatch,
  lookupOfflineSyncReceipt,
  openStaffSession,
  listEventGates,
  createEventGate,
  reserveCheckin,
  reissueTicketCredential,
  revokeStaffSession,
  revokeTicket,
  undoCheckin,
  unwrapConfirmOutcome,
  unwrapReserveOutcome,
  unwrapReissueOutcome,
  withTenant,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';
import { identityErrorHttpStatus } from './identity-http-status';
import {
  API_RATE_BUCKETS,
  API_RATE_LIMITS,
} from './http-limits';
import { consumeUserRateLimit } from './http-rate-limit';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ApiErrorDto implements ApiError {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiProperty() requestId!: string;
  @ApiProperty() retryable!: boolean;
}

class TenantBodyDto {
  @ApiProperty({ format: 'uuid' }) tenantId!: string;
}

class ReserveBodyDto extends TenantBodyDto {
  @ApiProperty({ format: 'uuid' }) ticketId!: string;
  @ApiProperty({ format: 'uuid' }) staffSessionId!: string;
}

class ConfirmBodyDto extends TenantBodyDto {
  @ApiProperty() token!: string;
  @ApiProperty({ format: 'uuid' }) staffSessionId!: string;
}

class ReasonBodyDto extends TenantBodyDto {
  @ApiProperty() reason!: string;
}

class RevokeSessionBodyDto extends TenantBodyDto {
  @ApiProperty({ format: 'uuid' }) staffSessionId!: string;
}

class OpenSessionBodyDto extends TenantBodyDto {
  @ApiProperty({ required: false, format: 'uuid', description: 'O31 optional gate' })
  gateId?: string;
}

class CreateGateBodyDto extends TenantBodyDto {
  @ApiProperty({ minLength: 1, maxLength: 80 }) name!: string;
  @ApiProperty({ required: false }) sortOrder?: number;
}

class GateDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() sortOrder!: number;
}

class GateListResponseDto {
  @ApiProperty({ type: [GateDto] }) gates!: GateDto[];
}

class SessionResponseDto {
  @ApiProperty({ format: 'uuid' }) sessionId!: string;
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ enum: ['ACTIVE'] }) status!: 'ACTIVE';
  @ApiProperty({ format: 'uuid', nullable: true }) gateId!: string | null;
  @ApiProperty({ nullable: true }) gateName!: string | null;
}

class ReserveResponseDto {
  @ApiProperty({ format: 'uuid' }) reservationId!: string;
  @ApiProperty() token!: string;
  @ApiProperty() expiresAt!: string;
  @ApiProperty({ format: 'uuid' }) ticketId!: string;
}

class ConfirmResponseDto {
  @ApiProperty({ format: 'uuid' }) checkinId!: string;
  @ApiProperty({ format: 'uuid' }) ticketId!: string;
  @ApiProperty({ format: 'uuid' }) reservationId!: string;
  @ApiProperty({ enum: ['USED'] }) state!: 'USED';
}

class ReissueResponseDto {
  @ApiProperty({ format: 'uuid' }) ticketId!: string;
  @ApiProperty() credentialVersion!: number;
  @ApiProperty() replayed!: boolean;
}

class OfflineSyncEventDto {
  @ApiProperty({ format: 'uuid' }) clientEventId!: string;
  @ApiProperty({ enum: OFFLINE_SYNC_EVENT_TYPES }) type!: 'CHECKIN_OFFLINE';
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ format: 'uuid' }) ticketId!: string;
  @ApiProperty({
    description: 'ISO-8601 UTC when the scan was accepted on-device',
  })
  clientOccurredAt!: string;
  @ApiProperty({
    minimum: 0,
    description: 'Monotonic per device+staffSession queue sequence',
  })
  clientSeq!: number;
  @ApiProperty({ enum: [OFFLINE_SYNC_PAYLOAD_VERSION] })
  payloadVersion!: typeof OFFLINE_SYNC_PAYLOAD_VERSION;
}

class OfflineSyncBodyDto {
  @ApiProperty({ format: 'uuid' }) tenantId!: string;
  @ApiProperty({ format: 'uuid' }) staffSessionId!: string;
  @ApiProperty({ format: 'uuid' }) deviceId!: string;
  @ApiProperty({
    description: 'ISO-8601 UTC client wall clock when the batch was assembled',
  })
  clientClockAt!: string;
  @ApiProperty({ type: [OfflineSyncEventDto] }) events!: OfflineSyncEventDto[];
}

class OfflineSyncItemResultDto {
  @ApiProperty({ format: 'uuid' }) clientEventId!: string;
  @ApiProperty({ enum: ['APPLIED', 'DUPLICATE', 'REJECTED', 'CONFLICT'] })
  status!: 'APPLIED' | 'DUPLICATE' | 'REJECTED' | 'CONFLICT';
  @ApiProperty({ required: false, format: 'uuid' }) checkinId?: string;
  @ApiProperty({
    required: false,
    enum: Object.values(OFFLINE_SYNC_ERROR_CODES),
  })
  code?: string;
  @ApiProperty({ required: false }) message?: string;
  @ApiProperty({ required: false, format: 'uuid' }) winningCheckinId?: string;
  @ApiProperty({ required: false, format: 'uuid' }) winningDeviceId?: string;
}

class OfflineSyncResponseDto {
  @ApiProperty() serverTime!: string;
  @ApiProperty({ enum: [OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS] })
  maxClockSkewSeconds!: typeof OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS;
  @ApiProperty({ type: [OfflineSyncItemResultDto] })
  results!: OfflineSyncItemResultDto[];
}

class OfflineSyncReceiptResponseDto {
  @ApiProperty({ format: 'uuid' }) tenantId!: string;
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ format: 'uuid' }) clientEventId!: string;
  @ApiProperty({ enum: ['APPLIED'] }) status!: 'APPLIED';
  @ApiProperty({ enum: [true] }) historical!: true;
  @ApiProperty({ format: 'uuid' }) ticketId!: string;
  @ApiProperty({ format: 'uuid' }) checkinId!: string;
  @ApiProperty({ format: 'uuid' }) staffSessionId!: string;
  @ApiProperty() appliedAt!: string;
  @ApiProperty({
    enum: ['CURRENT', 'UNDONE', 'TICKET_REVOKED', 'NO_LONGER_CURRENT'],
  })
  checkinState!:
    | 'CURRENT'
    | 'UNDONE'
    | 'TICKET_REVOKED'
    | 'NO_LONGER_CURRENT';
}

type GateDeps = {
  db: PrismaClient | null;
  verifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  bootError: IdentityError | null;
  credentialKey?: string | null;
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
  if (!UUID.test(trimmed)) {
    throw scopeError(`${name} must be a UUID`);
  }
  return trimmed;
}

function gateHttpException(error: GateError): HttpException {
  const body: ApiError = {
    code: error.code,
    message: error.message,
    requestId: randomUUID(),
    retryable:
      error.code === GATE_ERROR_CODES.OFFLINE_SYNC_RECEIPT_NOT_FOUND,
  };
  if (
    error.code === GATE_ERROR_CODES.OFFLINE_SYNC_RECEIPT_NOT_FOUND
  ) {
    return new HttpException(body, 404);
  }
  if (
    error.code === GATE_ERROR_CODES.OFFLINE_SYNC_BATCH_TOO_LARGE ||
    error.code === GATE_ERROR_CODES.OFFLINE_SYNC_CLOCK_SKEW_EXCEEDED ||
    error.code === GATE_ERROR_CODES.OFFLINE_SYNC_EVENT_TYPE_UNSUPPORTED ||
    error.code === GATE_ERROR_CODES.OFFLINE_SYNC_PAYLOAD_VERSION_UNSUPPORTED ||
    error.code === GATE_ERROR_CODES.OFFLINE_SYNC_REPLAY_ORDER_INVALID ||
    error.code === GATE_ERROR_CODES.OFFLINE_SYNC_IDEMPOTENCY_CONFLICT
  ) {
    return new HttpException(body, 422);
  }
  const status =
    error.code === GATE_ERROR_CODES.TICKET_NOT_FOUND ||
    error.code === GATE_ERROR_CODES.GATE_NOT_FOUND ||
    error.code === GATE_ERROR_CODES.RESERVATION_NOT_FOUND ||
    error.code === GATE_ERROR_CODES.CHECKIN_NOT_FOUND
      ? 404
      : 409;
  return new HttpException(body, status);
}

function authzHttpException(error: AuthzError): HttpException {
  return new HttpException(
    {
      code: error.code,
      message: error.message,
      requestId: randomUUID(),
      retryable: false,
    } satisfies ApiError,
    403,
  );
}

function identityHttpException(error: IdentityError): HttpException {
  return new HttpException(
    {
      code: error.code,
      message: error.message,
      requestId: randomUUID(),
      retryable: error.retryable,
    } satisfies ApiError,
    identityErrorHttpStatus(error.code),
  );
}

@Injectable()
export class GateService {
  constructor(private readonly deps: GateDeps) {}

  private async actor(authorization: string | undefined) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.db || !this.deps.verifier || !this.deps.users) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Gate services are not configured',
      );
    }
    const verified = await this.deps.verifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity(verified);
  }

  async openSession(
    authorization: string | undefined,
    eventId: string,
    tenantId: string,
    gateId?: string,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      openStaffSession(tx, { tenantId, eventId, userId: user.userId, gateId }),
    );
  }

  async listGates(
    authorization: string | undefined,
    eventId: string,
    tenantId: string,
  ) {
    const user = await this.actor(authorization);
    const gates = await withTenant(this.deps.db!, tenantId, (tx) =>
      listEventGates(tx, { tenantId, eventId, userId: user.userId }),
    );
    return { gates };
  }

  async createGate(
    authorization: string | undefined,
    eventId: string,
    body: CreateGateBodyDto,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, body.tenantId, (tx) =>
      createEventGate(tx, {
        tenantId: body.tenantId,
        eventId,
        userId: user.userId,
        name: body.name,
        sortOrder: body.sortOrder,
      }),
    );
  }

  async revokeSession(
    authorization: string | undefined,
    eventId: string,
    tenantId: string,
    staffSessionId: string,
  ) {
    const user = await this.actor(authorization);
    await withTenant(this.deps.db!, tenantId, (tx) =>
      revokeStaffSession(tx, {
        tenantId,
        eventId,
        sessionId: staffSessionId,
        actorUserId: user.userId,
      }),
    );
  }

  async reserve(
    authorization: string | undefined,
    eventId: string,
    body: ReserveBodyDto,
  ) {
    const user = await this.actor(authorization);
    await consumeUserRateLimit(
      this.deps.db,
      user.userId,
      API_RATE_BUCKETS.gateReserve,
      API_RATE_LIMITS.gateReservePerUser,
    );
    // Unwrap after withTenant so gate.reject audit commits on business deny.
    const hold = unwrapReserveOutcome(
      await withTenant(this.deps.db!, body.tenantId, (tx) =>
        reserveCheckin(tx, {
          tenantId: body.tenantId,
          eventId,
          ticketId: body.ticketId,
          staffSessionId: body.staffSessionId,
          actorUserId: user.userId,
        }),
      ),
    );
    return { ...hold, expiresAt: hold.expiresAt.toISOString() };
  }

  async confirm(
    authorization: string | undefined,
    eventId: string,
    reservationId: string,
    body: ConfirmBodyDto,
  ) {
    const user = await this.actor(authorization);
    await consumeUserRateLimit(
      this.deps.db,
      user.userId,
      API_RATE_BUCKETS.gateConfirm,
      API_RATE_LIMITS.gateConfirmPerUser,
    );
    return unwrapConfirmOutcome(
      await withTenant(this.deps.db!, body.tenantId, (tx) =>
        confirmCheckin(tx, {
          tenantId: body.tenantId,
          eventId,
          reservationId,
          token: body.token,
          staffSessionId: body.staffSessionId,
          actorUserId: user.userId,
        }),
      ),
    );
  }

  async undo(
    authorization: string | undefined,
    eventId: string,
    checkinId: string,
    body: ReasonBodyDto,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, body.tenantId, (tx) =>
      undoCheckin(tx, {
        tenantId: body.tenantId,
        eventId,
        checkinId,
        actorUserId: user.userId,
        reason: body.reason ?? '',
      }),
    );
  }

  async revoke(
    authorization: string | undefined,
    eventId: string,
    ticketId: string,
    body: ReasonBodyDto,
  ) {
    const user = await this.actor(authorization);
    await withTenant(this.deps.db!, body.tenantId, (tx) =>
      revokeTicket(tx, {
        tenantId: body.tenantId,
        eventId,
        ticketId,
        actorUserId: user.userId,
        reason: body.reason ?? '',
      }),
    );
  }

  async reissue(
    authorization: string | undefined,
    eventId: string,
    ticketId: string,
    body: ReasonBodyDto,
    idempotencyKey: string,
  ) {
    const user = await this.actor(authorization);
    if (!this.deps.credentialKey) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Credential services are not configured',
      );
    }
    return unwrapReissueOutcome(
      await withTenant(this.deps.db!, body.tenantId, (tx) =>
        reissueTicketCredential(tx, this.deps.credentialKey!, {
          tenantId: body.tenantId,
          eventId,
          ticketId,
          actorUserId: user.userId,
          reason: body.reason,
          idempotencyKey,
        }),
      ),
    );
  }

  /**
   * D7 offline queue replay (#106/#107): auth + validate + durable idempotent apply.
   */
  /**
   * Scoped historical receipt read (#859). Rate limit: dedicated read bucket so GET
   * reconciliation lookups do not consume POST offline-sync replay budget.
   */
  async offlineSyncReceipt(
    authorization: string | undefined,
    eventId: string,
    tenantId: string,
    clientEventId: string,
  ): Promise<OfflineSyncReceiptResponse> {
    const user = await this.actor(authorization);
    await consumeUserRateLimit(
      this.deps.db,
      user.userId,
      API_RATE_BUCKETS.gateOfflineSyncReceipt,
      API_RATE_LIMITS.gateOfflineSyncReceiptPerUser,
    );
    return withTenant(this.deps.db!, tenantId, (tx) =>
      lookupOfflineSyncReceipt(tx, {
        tenantId,
        pathEventId: eventId,
        clientEventId,
        actorUserId: user.userId,
      }),
    );
  }

  async offlineSync(
    authorization: string | undefined,
    eventId: string,
    body: OfflineSyncBodyDto,
  ): Promise<OfflineSyncResponse> {
    const user = await this.actor(authorization);
    await consumeUserRateLimit(
      this.deps.db,
      user.userId,
      API_RATE_BUCKETS.gateOfflineSync,
      API_RATE_LIMITS.gateOfflineSyncPerUser,
    );
    return withTenant(this.deps.db!, body.tenantId, (tx) =>
      applyOfflineSyncBatch(tx, {
        pathEventId: eventId,
        body,
        actorUserId: user.userId,
      }),
    );
  }
}

@ApiTags('gate')
@Controller()
export class GateController {
  constructor(private readonly gate: GateService) {}

  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof IdentityError) throw identityHttpException(error);
      if (error instanceof AuthzError) throw authzHttpException(error);
      if (error instanceof GateError) throw gateHttpException(error);
      if (error instanceof EventError) {
        throw new HttpException(
          {
            code: error.code,
            message: error.message,
            requestId: randomUUID(),
            retryable: error.retryable,
          } satisfies ApiError,
          error.code === EVENT_ERROR_CODES.IDEMPOTENCY_CONFLICT ||
          error.code === EVENT_ERROR_CODES.RETRYABLE_CONFLICT
            ? 409
            : 422,
        );
      }
      throw error;
    }
  }

  @Post('gate/events/:eventId/sessions')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @Header('Cache-Control', 'private, no-store')
  openSession(
    @Headers('authorization') authorization: string | undefined,
    @Param('eventId') eventId: string,
    @Body() body: OpenSessionBodyDto,
  ) {
    const event = requireUuid(eventId, 'eventId');
    const tenantId = requireUuid(body?.tenantId, 'tenantId');
    const gateId =
      body?.gateId === undefined || body.gateId === null
        ? undefined
        : requireUuid(body.gateId, 'gateId');
    return this.run(() =>
      this.gate.openSession(authorization, event, tenantId, gateId),
    );
  }

  @Get('gate/events/:eventId/gates')
  @ApiBearerAuth()
  @ApiOkResponse({ type: GateListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  listGates(
    @Headers('authorization') authorization: string | undefined,
    @Param('eventId') eventId: string,
    @Query('tenantId') tenantIdRaw: string,
  ) {
    const event = requireUuid(eventId, 'eventId');
    const tenantId = requireUuid(tenantIdRaw, 'tenantId');
    return this.run(() => this.gate.listGates(authorization, event, tenantId));
  }

  @Post('gate/events/:eventId/gates')
  @ApiBearerAuth()
  @ApiOkResponse({ type: GateDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  createGate(
    @Headers('authorization') authorization: string | undefined,
    @Param('eventId') eventId: string,
    @Body() body: CreateGateBodyDto,
  ) {
    const event = requireUuid(eventId, 'eventId');
    requireUuid(body?.tenantId, 'tenantId');
    if (typeof body?.name !== 'string' || !body.name.trim()) {
      throw scopeError('name is required');
    }
    if (body.sortOrder !== undefined && !Number.isInteger(body.sortOrder)) {
      throw scopeError('sortOrder must be an integer');
    }
    return this.run(() => this.gate.createGate(authorization, event, body));
  }

  @Post('gate/events/:eventId/sessions/revoke')
  @ApiBearerAuth()
  @Header('Cache-Control', 'private, no-store')
  revokeSession(
    @Headers('authorization') authorization: string | undefined,
    @Param('eventId') eventId: string,
    @Body() body: RevokeSessionBodyDto,
  ) {
    const event = requireUuid(eventId, 'eventId');
    const tenantId = requireUuid(body?.tenantId, 'tenantId');
    const staffSessionId = requireUuid(body?.staffSessionId, 'staffSessionId');
    return this.run(async () => {
      await this.gate.revokeSession(authorization, event, tenantId, staffSessionId);
      return { status: 'REVOKED' as const, staffSessionId };
    });
  }

  @Post('gate/events/:eventId/reservations')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOkResponse({ type: ReserveResponseDto })
  reserve(
    @Headers('authorization') authorization: string | undefined,
    @Param('eventId') eventId: string,
    @Body() body: ReserveBodyDto,
  ) {
    const event = requireUuid(eventId, 'eventId');
    requireUuid(body?.tenantId, 'tenantId');
    requireUuid(body?.ticketId, 'ticketId');
    requireUuid(body?.staffSessionId, 'staffSessionId');
    return this.run(() => this.gate.reserve(authorization, event, body));
  }

  @Post('gate/events/:eventId/reservations/:reservationId/confirm')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOkResponse({ type: ConfirmResponseDto })
  confirm(
    @Headers('authorization') authorization: string | undefined,
    @Param('eventId') eventId: string,
    @Param('reservationId') reservationId: string,
    @Body() body: ConfirmBodyDto,
  ) {
    const event = requireUuid(eventId, 'eventId');
    const reservation = requireUuid(reservationId, 'reservationId');
    requireUuid(body?.tenantId, 'tenantId');
    requireUuid(body?.staffSessionId, 'staffSessionId');
    if (!body?.token?.trim()) throw scopeError('token is required');
    return this.run(() =>
      this.gate.confirm(authorization, event, reservation, body),
    );
  }

  @Post('gate/events/:eventId/checkins/:checkinId/undo')
  @ApiBearerAuth()
  undo(
    @Headers('authorization') authorization: string | undefined,
    @Param('eventId') eventId: string,
    @Param('checkinId') checkinId: string,
    @Body() body: ReasonBodyDto,
  ) {
    const event = requireUuid(eventId, 'eventId');
    const checkin = requireUuid(checkinId, 'checkinId');
    requireUuid(body?.tenantId, 'tenantId');
    if (!body?.reason?.trim()) throw scopeError('reason is required');
    return this.run(() => this.gate.undo(authorization, event, checkin, body));
  }

  @Post('gate/events/:eventId/tickets/:ticketId/revoke')
  @ApiBearerAuth()
  revoke(
    @Headers('authorization') authorization: string | undefined,
    @Param('eventId') eventId: string,
    @Param('ticketId') ticketId: string,
    @Body() body: ReasonBodyDto,
  ) {
    const event = requireUuid(eventId, 'eventId');
    const ticket = requireUuid(ticketId, 'ticketId');
    requireUuid(body?.tenantId, 'tenantId');
    if (!body?.reason?.trim()) throw scopeError('reason is required');
    return this.run(async () => {
      await this.gate.revoke(authorization, event, ticket, body);
      return { status: 'REVOKED' as const, ticketId: ticket };
    });
  }

  @Post('gate/events/:eventId/tickets/:ticketId/reissue')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOkResponse({ type: ReissueResponseDto })
  @ApiResponse({ status: 409, type: ApiErrorDto })
  @ApiResponse({ status: 422, type: ApiErrorDto })
  @Header('Cache-Control', 'private, no-store')
  reissue(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('eventId') eventId: string,
    @Param('ticketId') ticketId: string,
    @Body() body: ReasonBodyDto,
  ) {
    const event = requireUuid(eventId, 'eventId');
    const ticket = requireUuid(ticketId, 'ticketId');
    requireUuid(body?.tenantId, 'tenantId');
    if (typeof body?.reason !== 'string' || !body.reason.trim()) {
      throw scopeError('reason is required');
    }
    const key = requireUuid(idempotencyKey, 'Idempotency-Key');
    return this.run(() =>
      this.gate.reissue(authorization, event, ticket, body, key),
    );
  }

  @Get('gate/events/:eventId/offline-sync/receipts/:clientEventId')
  @ApiBearerAuth()
  @ApiOkResponse({ type: OfflineSyncReceiptResponseDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  offlineSyncReceipt(
    @Headers('authorization') authorization: string | undefined,
    @Param('eventId') eventId: string,
    @Param('clientEventId') clientEventId: string,
    @Query('tenantId') tenantIdRaw: string,
  ) {
    const event = requireUuid(eventId, 'eventId');
    const clientEvent = requireUuid(clientEventId, 'clientEventId');
    const tenantId = requireUuid(tenantIdRaw, 'tenantId');
    return this.run(() =>
      this.gate.offlineSyncReceipt(
        authorization,
        event,
        tenantId,
        clientEvent,
      ),
    );
  }

  @Post('gate/events/:eventId/offline-sync')
  @ApiBearerAuth()
  @ApiOkResponse({ type: OfflineSyncResponseDto })
  @ApiResponse({ status: 422, type: ApiErrorDto })
  @ApiResponse({ status: 409, type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  offlineSync(
    @Headers('authorization') authorization: string | undefined,
    @Param('eventId') eventId: string,
    @Body() body: OfflineSyncBodyDto,
  ) {
    const event = requireUuid(eventId, 'eventId');
    if (!body) throw scopeError('request body is required');
    requireUuid(body.tenantId, 'tenantId');
    requireUuid(body.staffSessionId, 'staffSessionId');
    requireUuid(body.deviceId, 'deviceId');
    if (!Array.isArray(body.events)) {
      throw scopeError('events must be an array');
    }
    return this.run(() => this.gate.offlineSync(authorization, event, body));
  }
}
