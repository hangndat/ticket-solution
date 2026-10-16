import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Headers,
  HttpException,
  Injectable,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type ApiError } from '@ticket/contracts';
import {
  AuthzError,
  GateError,
  GATE_ERROR_CODES,
  IdentityError,
  IDENTITY_ERROR_CODES,
  confirmCheckin,
  openStaffSession,
  reserveCheckin,
  revokeStaffSession,
  revokeTicket,
  undoCheckin,
  withTenant,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';

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

class SessionResponseDto {
  @ApiProperty({ format: 'uuid' }) sessionId!: string;
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ enum: ['ACTIVE'] }) status!: 'ACTIVE';
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

type GateDeps = {
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
    retryable: false,
  };
  const status =
    error.code === GATE_ERROR_CODES.TICKET_NOT_FOUND ||
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
  const status =
    error.code === IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED ? 503 : 401;
  return new HttpException(
    {
      code: error.code,
      message: error.message,
      requestId: randomUUID(),
      retryable: error.retryable,
    } satisfies ApiError,
    status,
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
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      openStaffSession(tx, { tenantId, eventId, userId: user.userId }),
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
    const hold = await withTenant(this.deps.db!, body.tenantId, (tx) =>
      reserveCheckin(tx, {
        tenantId: body.tenantId,
        eventId,
        ticketId: body.ticketId,
        staffSessionId: body.staffSessionId,
        actorUserId: user.userId,
      }),
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
    return withTenant(this.deps.db!, body.tenantId, (tx) =>
      confirmCheckin(tx, {
        tenantId: body.tenantId,
        eventId,
        reservationId,
        token: body.token,
        staffSessionId: body.staffSessionId,
        actorUserId: user.userId,
      }),
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
}

@ApiTags('gate')
@Controller()
export class GateController {
  constructor(private readonly gate: GateService) {}

  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof IdentityError) throw identityHttpException(error);
      if (error instanceof AuthzError) throw authzHttpException(error);
      if (error instanceof GateError) throw gateHttpException(error);
      throw error;
    }
  }

  @Post('gate/events/:eventId/sessions')
  @ApiBearerAuth()
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  openSession(
    @Headers('authorization') authorization: string | undefined,
    @Param('eventId') eventId: string,
    @Body() body: TenantBodyDto,
  ) {
    const event = requireUuid(eventId, 'eventId');
    const tenantId = requireUuid(body?.tenantId, 'tenantId');
    return this.run(() => this.gate.openSession(authorization, event, tenantId));
  }

  @Post('gate/events/:eventId/sessions/revoke')
  @ApiBearerAuth()
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
}
