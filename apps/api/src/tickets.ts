import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Header,
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
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  IDENTITY_ERROR_CODES,
  ISSUE_ERROR_CODES,
  type ApiError,
  type MeTicketsResponse,
  type OperationStatusResponse,
  type RedeemRequestBody,
  type RedeemResponse,
  type TicketSummary,
} from '@ticket/contracts';
import {
  IdentityError,
  IssueError,
  PlatformError,
  REDEEM_COMMAND,
  createDatabase,
  configureIssuanceLockTimeout,
  getOperationForActor,
  isRetryableTransactionConflict,
  getTicketForOwner,
  listOwnerTicketsAggregated,
  listTicketsForOwner,
  readCodeHmacEnvironment,
  readCredentialKeyEnvironment,
  readResolveTokenSecret,
  readSupportedPepperConfigs,
  redeemAndIssueTicket,
  getOwnerRedemptionStatus,
  throwIfStoredRejection,
  unwrapRedeemOutcome,
  type PendingApprovalResult,
  withTenant,
  type CodeHmacConfig,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';
import { identityErrorHttpStatus } from './identity-http-status';
import { platformRouteFail } from './platform/platform-errors';
import {
  API_RATE_BUCKETS,
  API_RATE_LIMITS,
} from './http-limits';
import { consumeUserRateLimit } from './http-rate-limit';
import { requireUuidParam, validationError } from './http-validation';

class ApiErrorDto implements ApiError {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiProperty() requestId!: string;
  @ApiProperty({ required: false }) operationId?: string;
  @ApiProperty() retryable!: boolean;
}

class RedeemBodyDto implements RedeemRequestBody {
  @ApiProperty() code!: string;
  @ApiProperty({ required: false }) formVersion?: string;
  @ApiProperty({ required: false }) termsVersion?: string;
  @ApiProperty({
    required: false,
    description: 'Map fieldId → string|boolean; unknown keys rejected',
  })
  answers?: Record<string, string | boolean>;
  @ApiProperty({ required: false }) termsAccepted?: true;
}

class RedeemResponseDto implements RedeemResponse {
  @ApiProperty({ format: 'uuid' }) ticketId!: string;
  @ApiProperty({ format: 'uuid' }) requestId!: string;
  @ApiProperty({ format: 'uuid' }) operationId!: string;
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ format: 'uuid' }) ticketTypeId!: string;
  @ApiProperty({ format: 'uuid' }) sourceId!: string;
  @ApiProperty({ enum: ['ACTIVE'] }) state!: 'ACTIVE';
  @ApiProperty() credentialVersion!: number;
  @ApiProperty() replayed!: boolean;
}

class TicketSummaryDto implements TicketSummary {
  @ApiProperty({ format: 'uuid' }) ticketId!: string;
  @ApiProperty({ format: 'uuid' }) tenantId!: string;
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ format: 'uuid' }) ticketTypeId!: string;
  @ApiProperty({ format: 'uuid' }) sourceId!: string;
  @ApiProperty() state!: string;
  @ApiProperty() credentialVersion!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ required: false }) eventName?: string;
}

class MeTicketsDto implements MeTicketsResponse {
  @ApiProperty({ type: [TicketSummaryDto] }) tickets!: TicketSummaryDto[];
}

const TENANT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tenantIdQueryError(): HttpException {
  return new HttpException(
    {
      code: 'INVALID_TENANT',
      message: 'tenantId must be a valid UUID when provided',
      requestId: randomUUID(),
      retryable: false,
    } satisfies ApiError,
    422,
  );
}

export function issueHttpException(error: IssueError, operationId?: string): HttpException {
  const requestId = randomUUID();
  const body: ApiError & { fields?: IssueError['fields'] } = {
    code: error.code,
    message: error.message,
    requestId,
    operationId,
    retryable: error.retryable,
  };
  if (error.fields?.length) body.fields = error.fields;
  if (error.code === ISSUE_ERROR_CODES.CODE_HMAC_MISCONFIGURED) {
    body.message = 'Issue services are not configured';
  }
  const status =
    error.code === ISSUE_ERROR_CODES.EMAIL_NOT_VERIFIED
      ? 403
      : error.code === ISSUE_ERROR_CODES.REDEMPTION_NOT_FOUND ||
          error.code === ISSUE_ERROR_CODES.TICKET_NOT_FOUND
        ? 404
        : error.code === ISSUE_ERROR_CODES.FORM_VERSION_STALE ||
            error.code === ISSUE_ERROR_CODES.TERMS_VERSION_STALE ||
            error.code === ISSUE_ERROR_CODES.IDEMPOTENCY_CONFLICT ||
            error.code === ISSUE_ERROR_CODES.CODE_CONSUMED ||
            error.code === ISSUE_ERROR_CODES.QUOTA_EXHAUSTED ||
            error.code === ISSUE_ERROR_CODES.PENDING_EXPIRED ||
            error.code === ISSUE_ERROR_CODES.PENDING_LIMIT
          ? 409
          : error.code === ISSUE_ERROR_CODES.RETRYABLE_CONFLICT
            ? 503
            : error.code === ISSUE_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED ||
                error.code === ISSUE_ERROR_CODES.CODE_INVALID ||
                error.code === ISSUE_ERROR_CODES.FORM_REQUIRED ||
                error.code === ISSUE_ERROR_CODES.FORM_INVALID ||
                error.code === ISSUE_ERROR_CODES.TERMS_REQUIRED ||
                error.code === ISSUE_ERROR_CODES.RESOLVE_TOKEN_REQUIRED ||
                error.code === ISSUE_ERROR_CODES.RESOLVE_TOKEN_STALE
              ? 422
              : 409;
  return new HttpException(body, status);
}

export function identityHttpException(error: IdentityError): HttpException {
  const requestId = randomUUID();
  const body: ApiError = {
    code: error.code,
    message: error.message,
    requestId,
    retryable: error.retryable,
  };
  return new HttpException(body, identityErrorHttpStatus(error.code));
}

export type TicketServices = {
  db: PrismaClient | null;
  verifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  bootError: IdentityError | null;
  hmac: CodeHmacConfig | null;
  credentialKey: string | null;
  routingPeppers?: CodeHmacConfig[] | null;
  resolveTokenSecret?: string | null;
};

@Injectable()
export class TicketIssueService {
  constructor(private readonly deps: TicketServices) {}

  private async requireUser(authorization: string | undefined) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.verifier || !this.deps.users) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Identity services are not configured',
      );
    }
    const verified = await this.deps.verifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity(verified);
  }

  async redeem(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    idempotencyKey: string | undefined,
    body: RedeemRequestBody,
    resolveTokenHeader?: string,
  ): Promise<RedeemResponse | PendingApprovalResult> {
    if (!this.deps.db || !this.deps.hmac || !this.deps.credentialKey) {
      throw new IssueError(
        ISSUE_ERROR_CODES.CODE_HMAC_MISCONFIGURED,
        'Issue services are not configured',
      );
    }
    const user = await this.requireUser(authorization);
    await consumeUserRateLimit(
      this.deps.db,
      user.userId,
      API_RATE_BUCKETS.redeem,
      API_RATE_LIMITS.redeemPerUser,
    );
    // Commit terminal rejection inside withTenant, then map to IssueError outside
    // so operations COMPLETED+rejection is durable (TD §8.1).
    let outcome;
    try {
      outcome = await withTenant(this.deps.db, tenantId, async (tx) => {
        await configureIssuanceLockTimeout(tx);
        return redeemAndIssueTicket(tx, this.deps.hmac!, this.deps.credentialKey!, {
          tenantId,
          eventId,
          actorUserId: user.userId,
          actorEmail: user.email,
          emailVerified: user.emailVerified,
          rawCode: body.code,
          idempotencyKey: idempotencyKey ?? '',
          formVersion: body.formVersion,
          termsVersion: body.termsVersion,
          answers: body.answers,
          termsAccepted: body.termsAccepted,
          resolveToken: resolveTokenHeader?.trim() || undefined,
          resolveTokenSecret: this.deps.resolveTokenSecret ?? undefined,
          routingPeppers: this.deps.routingPeppers ?? undefined,
        });
      });
    } catch (error) {
      // This also sees errors before the business savepoint and at COMMIT.
      // withTenant has rolled back before the HTTP layer sees a conflict.
      if (isRetryableTransactionConflict(error)) {
        throw new IssueError(
          ISSUE_ERROR_CODES.RETRYABLE_CONFLICT,
          'Issuance transaction conflicted; retry with the same key',
          true,
        );
      }
      if (error instanceof PlatformError) platformRouteFail(error);
      throw error;
    }
    if (outcome.ok === 'pending') return outcome.result;
    return unwrapRedeemOutcome(outcome);
  }

  async ownerRedemptionStatus(
    authorization: string | undefined,
    tenantId: string,
    requestId: string,
  ) {
    if (!this.deps.db) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Identity services are not configured',
      );
    }
    const user = await this.requireUser(authorization);
    return withTenant(this.deps.db, tenantId, (tx) =>
      getOwnerRedemptionStatus(tx, {
        tenantId,
        requestId,
        ownerUserId: user.userId,
      }),
    );
  }

  async listMine(
    authorization: string | undefined,
    tenantId: string,
  ): Promise<MeTicketsResponse> {
    const user = await this.requireUser(authorization);
    if (!this.deps.db) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Database is not configured',
      );
    }
    const tickets = await withTenant(this.deps.db, tenantId, (tx) =>
      listTicketsForOwner(tx, tenantId, user.userId),
    );
    return {
      tickets: tickets.map(
        (t): TicketSummary => ({
          ticketId: t.ticketId,
          tenantId,
          eventId: t.eventId,
          ticketTypeId: t.ticketTypeId,
          sourceId: t.sourceId,
          state: t.state,
          credentialVersion: t.credentialVersion,
          createdAt: t.createdAt.toISOString(),
          ...(t.eventName != null ? { eventName: t.eventName } : {}),
        }),
      ),
    };
  }

  async listMineAll(
    authorization: string | undefined,
  ): Promise<MeTicketsResponse> {
    const user = await this.requireUser(authorization);
    if (!this.deps.db) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Database is not configured',
      );
    }
    const tickets = await listOwnerTicketsAggregated(
      this.deps.db,
      user.userId,
    );
    return {
      tickets: tickets.map(
        (t): TicketSummary => ({
          ticketId: t.ticketId,
          tenantId: t.tenantId,
          eventId: t.eventId,
          ticketTypeId: t.ticketTypeId,
          sourceId: t.sourceId,
          state: t.state,
          credentialVersion: t.credentialVersion,
          createdAt: t.createdAt.toISOString(),
          ...(t.eventName != null ? { eventName: t.eventName } : {}),
        }),
      ),
    };
  }

  async getMine(
    authorization: string | undefined,
    tenantId: string,
    ticketId: string,
  ): Promise<TicketSummary> {
    if (!this.deps.db) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Database is not configured',
      );
    }
    const user = await this.requireUser(authorization);
    const ticket = await withTenant(this.deps.db, tenantId, (tx) =>
      getTicketForOwner(tx, tenantId, user.userId, ticketId),
    );
    return {
      ticketId: ticket.ticketId,
      tenantId,
      eventId: ticket.eventId,
      ticketTypeId: ticket.ticketTypeId,
      sourceId: ticket.sourceId,
      state: ticket.state,
      credentialVersion: ticket.credentialVersion,
      createdAt: ticket.createdAt.toISOString(),
    };
  }

  async operationStatus(
    authorization: string | undefined,
    clientKey: string,
    tenantId: string,
    eventId: string,
    command: string,
  ): Promise<OperationStatusResponse> {
    if (!this.deps.db) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Database is not configured',
      );
    }
    const user = await this.requireUser(authorization);
    const row = await withTenant(this.deps.db, tenantId, (tx) =>
      getOperationForActor(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        command: command || REDEEM_COMMAND,
        clientKey,
      }),
    );
    if (!row) {
      throw new HttpException(
        {
          code: 'NOT_FOUND',
          message: 'Operation not found',
          requestId: randomUUID(),
          retryable: true,
        } satisfies ApiError,
        404,
      );
    }
    if (row.status === 'COMPLETED' && row.response) {
      try {
        throwIfStoredRejection(row.response);
      } catch (error) {
        if (error instanceof IssueError) {
          return {
            operationId: row.operationId,
            status: row.status,
            response: {
              code: error.code,
              message: error.message,
              requestId: randomUUID(),
              operationId: row.operationId,
              retryable: error.retryable,
            },
          };
        }
        throw error;
      }
    }
    return {
      operationId: row.operationId,
      status: row.status,
      response: row.response as RedeemResponse | null,
    };
  }
}

@ApiTags('redemptions')
@Controller()
export class TicketIssueController {
  constructor(private readonly tickets: TicketIssueService) {}

  @Post('tenants/:tenantId/events/:eventId/redemptions')
  @ApiBearerAuth()
  @ApiHeader({ name: 'idempotency-key', required: true })
  @ApiOkResponse({ type: RedeemResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  async redeem(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-redemption-resolve-token') resolveToken: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: RedeemBodyDto,
  ): Promise<RedeemResponse | PendingApprovalResult> {
    if (!body?.code || typeof body.code !== 'string') {
      throw validationError('INVALID_BODY', 'code is required');
    }
    try {
      return await this.tickets.redeem(
        authorization,
        requireUuidParam(tenantId, 'tenantId'),
        requireUuidParam(eventId, 'eventId'),
        idempotencyKey,
        body,
        resolveToken,
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof IdentityError) throw identityHttpException(error);
      if (error instanceof IssueError) throw issueHttpException(error);
      throw error;
    }
  }

  @Get('me/redemptions/:requestId')
  @ApiBearerAuth()
  @Header('Cache-Control', 'private, no-store')
  async meRedemptionStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param('requestId') requestId: string,
    @Query('tenantId') tenantId: string,
  ) {
    if (!tenantId) {
      throw new HttpException(
        {
          code: 'TENANT_REQUIRED',
          message: 'tenantId query parameter is required',
          requestId: randomUUID(),
          retryable: false,
        } satisfies ApiError,
        422,
      );
    }
    try {
      return await this.tickets.ownerRedemptionStatus(
        authorization,
        requireUuidParam(tenantId, 'tenantId'),
        requireUuidParam(requestId, 'requestId'),
      );
    } catch (error) {
      if (error instanceof IdentityError) throw identityHttpException(error);
      if (error instanceof IssueError) throw issueHttpException(error);
      throw error;
    }
  }

  @Get('me/tickets')
  @ApiBearerAuth()
  @ApiQuery({
    name: 'tenantId',
    required: false,
    description:
      'Optional tenant UUID; omit to list all owner tickets across tenants (W1 aggregate).',
  })
  @ApiOkResponse({ type: MeTicketsDto })
  @Header('Cache-Control', 'private, no-store')
  async meTickets(
    @Headers('authorization') authorization: string | undefined,
    @Query('tenantId') tenantId?: string,
  ): Promise<MeTicketsResponse> {
    const scoped = tenantId?.trim();
    if (scoped && !TENANT_UUID_RE.test(scoped)) {
      throw tenantIdQueryError();
    }
    try {
      if (!scoped) {
        return await this.tickets.listMineAll(authorization);
      }
      return await this.tickets.listMine(authorization, scoped);
    } catch (error) {
      if (error instanceof IdentityError) throw identityHttpException(error);
      if (error instanceof Error && error.message === 'Invalid tenant ID') {
        throw tenantIdQueryError();
      }
      throw error;
    }
  }

  @Get('me/tickets/:ticketId')
  @ApiBearerAuth()
  @ApiOkResponse({ type: TicketSummaryDto })
  @Header('Cache-Control', 'private, no-store')
  async meTicketById(
    @Headers('authorization') authorization: string | undefined,
    @Param('ticketId') ticketId: string,
    @Query('tenantId') tenantId: string,
  ): Promise<TicketSummary> {
    if (!tenantId) {
      throw new HttpException(
        {
          code: 'TENANT_REQUIRED',
          message: 'tenantId query parameter is required',
          requestId: randomUUID(),
          retryable: false,
        } satisfies ApiError,
        422,
      );
    }
    try {
      return await this.tickets.getMine(
        authorization,
        requireUuidParam(tenantId, 'tenantId'),
        requireUuidParam(ticketId, 'ticketId'),
      );
    } catch (error) {
      if (error instanceof IdentityError) throw identityHttpException(error);
      if (error instanceof IssueError) throw issueHttpException(error);
      throw error;
    }
  }

  @Get('operations/:clientOperationId')
  @ApiBearerAuth()
  async operation(
    @Headers('authorization') authorization: string | undefined,
    @Param('clientOperationId') clientOperationId: string,
    @Query('tenantId') tenantId: string,
    @Query('eventId') eventId: string,
    @Query('command') command?: string,
  ): Promise<OperationStatusResponse> {
    if (!tenantId || !eventId) {
      throw new HttpException(
        {
          code: 'SCOPE_REQUIRED',
          message: 'tenantId and eventId query parameters are required',
          requestId: randomUUID(),
          retryable: false,
        } satisfies ApiError,
        422,
      );
    }
    try {
      return await this.tickets.operationStatus(
        authorization,
        clientOperationId,
        requireUuidParam(tenantId, 'tenantId'),
        requireUuidParam(eventId, 'eventId'),
        command ?? REDEEM_COMMAND,
      );
    } catch (error) {
      if (error instanceof IdentityError) throw identityHttpException(error);
      if (error instanceof HttpException) throw error;
      throw error;
    }
  }
}

export function resolveIssueDeps(env: NodeJS.ProcessEnv): {
  hmac: CodeHmacConfig | null;
  credentialKey: string | null;
  issueBootError: IdentityError | null;
  routingPeppers: CodeHmacConfig[] | null;
  resolveTokenSecret: string | null;
} {
  try {
    const hmac = readCodeHmacEnvironment(env);
    const credentialKey = readCredentialKeyEnvironment(env);
    let routingPeppers: CodeHmacConfig[] | null = null;
    let resolveTokenSecret: string | null = null;
    try {
      routingPeppers = readSupportedPepperConfigs(env);
      resolveTokenSecret = readResolveTokenSecret(env);
    } catch {
      routingPeppers = null;
      resolveTokenSecret = null;
    }
    return {
      hmac,
      credentialKey,
      issueBootError: null,
      routingPeppers,
      resolveTokenSecret,
    };
  } catch {
    return {
      hmac: null,
      credentialKey: null,
      issueBootError: new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Issue services are not configured',
      ),
      routingPeppers: null,
      resolveTokenSecret: null,
    };
  }
}

export { createDatabase };
