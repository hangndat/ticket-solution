import { randomUUID } from 'node:crypto';
import {
  Controller,
  Get,
  Headers,
  HttpException,
  Injectable,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { type ApiError } from '@ticket/contracts';
import {
  AuthzError,
  IdentityError,
  IDENTITY_ERROR_CODES,
  ReportError,
  REPORT_ERROR_CODES,
  listEventAudit,
  readEventReport,
  readPortfolioReport,
  withTenant,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';
import { identityErrorHttpStatus } from './identity-http-status';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class TicketStateCountsDto {
  @ApiProperty() ACTIVE!: number;
  @ApiProperty() REVOKED!: number;
  @ApiProperty() CANCELLED!: number;
  @ApiProperty() USED!: number;
}

class EventQuotaSummaryDto {
  @ApiProperty({ nullable: true, type: Number }) capacity!: number | null;
  @ApiProperty() allocated!: number;
}

class EventReportDto {
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ type: TicketStateCountsDto })
  ticketsByState!: TicketStateCountsDto;
  @ApiProperty({ type: EventQuotaSummaryDto }) quota!: EventQuotaSummaryDto;
  /**
   * Remaining seats when quotaCapacityState=FINITE.
   * null for UNLIMITED or MISSING_BUCKET — never a fake 0.
   */
  @ApiProperty({ nullable: true, type: Number })
  quotaRemaining!: number | null;
  @ApiProperty({
    enum: ['FINITE', 'UNLIMITED', 'MISSING_BUCKET'],
    description:
      'FINITE: capacity number + remaining; UNLIMITED: bucket capacity null; MISSING_BUCKET: no EVENT bucket',
  })
  quotaCapacityState!: 'FINITE' | 'UNLIMITED' | 'MISSING_BUCKET';
  @ApiProperty() pendingApprovalCount!: number;
  /**
   * Current Gate admits (checkins with undone_at IS NULL).
   * Diverges from ticketsByState.USED after Supervisor undo.
   */
  @ApiProperty() checkInSuccessCount!: number;
  /**
   * Aggregate Gate rejects by stable reason/code (audit action gate.reject).
   * No per-attendee PII.
   */
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { ALREADY_CHECKED_IN: 2, TICKET_NOT_ACTIVE: 1 },
  })
  rejectByReason!: Record<string, number>;
  /**
   * Email notifications needing CS: DEAD after delivery exhaustion.
   * Temporary FAILED and DEAD from ticket revoke/cancel are excluded.
   */
  @ApiProperty() emailNeedsCsCount!: number;
  /** Server clock watermark for this snapshot (ISO-8601). */
  @ApiProperty({ format: 'date-time' }) asOf!: string;
}

class PortfolioReportItemDto {
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ description: 'Event display name (events.name)' })
  title!: string;
  @ApiProperty() checkInSuccessCount!: number;
  @ApiProperty() pendingApprovalCount!: number;
  @ApiProperty() emailNeedsCsCount!: number;
  @ApiProperty({ nullable: true, type: Number })
  quotaRemaining!: number | null;
  @ApiProperty({ enum: ['FINITE', 'UNLIMITED', 'MISSING_BUCKET'] })
  quotaCapacityState!: 'FINITE' | 'UNLIMITED' | 'MISSING_BUCKET';
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { ALREADY_CHECKED_IN: 2 },
    description: 'Gate rejects by stable reason — no attendee PII',
  })
  rejectByReason!: Record<string, number>;
}

class PortfolioReportDto {
  /** Single server watermark for the whole response (ISO-8601). */
  @ApiProperty({ format: 'date-time' }) asOf!: string;
  @ApiProperty({ type: [PortfolioReportItemDto] })
  items!: PortfolioReportItemDto[];
  @ApiProperty({ nullable: true, type: String })
  nextCursor!: string | null;
  /** Effective limit after clamp (default 20, hard max 50). */
  @ApiProperty() limit!: number;
}

class PortalAuditEntryDto {
  @ApiProperty({ format: 'uuid' }) auditId!: string;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  actorUserId!: string | null;
  @ApiProperty() action!: string;
  @ApiProperty() resourceType!: string;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  resourceId!: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  operationId!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

class PortalAuditPageDto {
  @ApiProperty({ type: [PortalAuditEntryDto] }) items!: PortalAuditEntryDto[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
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
  if (!value || !UUID.test(value)) throw scopeError(`${name} must be a UUID`);
  return value;
}

@Injectable()
export class ReportService {
  constructor(private readonly deps: Deps) {}

  private async actor(authorization: string | undefined) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.verifier || !this.deps.users) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Report services are not configured',
      );
    }
    const verified = await this.deps.verifier.verifyBearerToken(authorization);
    if (!this.deps.db) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Report services are not configured',
      );
    }
    return this.deps.users.upsertFromVerifiedIdentity(verified);
  }

  async eventReport(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      readEventReport(tx, { tenantId, eventId, actorUserId: user.userId }),
    );
  }

  async portfolioReport(
    authorization: string | undefined,
    tenantId: string,
    query: { cursor?: string; limit?: string },
  ) {
    const user = await this.actor(authorization);
    const limit = query.limit ? Number(query.limit) : undefined;
    return withTenant(this.deps.db!, tenantId, (tx) =>
      readPortfolioReport(tx, {
        tenantId,
        actorUserId: user.userId,
        cursor: query.cursor,
        limit: Number.isFinite(limit) ? limit : undefined,
      }),
    );
  }

  async eventAudit(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    query: {
      cursor?: string;
      limit?: string;
      from?: string;
      to?: string;
      action?: string;
    },
  ) {
    const user = await this.actor(authorization);
    const limit = query.limit ? Number(query.limit) : undefined;
    return withTenant(this.deps.db!, tenantId, (tx) =>
      listEventAudit(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        cursor: query.cursor,
        limit: Number.isFinite(limit) ? limit : undefined,
        from: query.from,
        to: query.to,
        action: query.action,
      }),
    );
  }
}

@ApiTags('reporting')
@Controller()
export class ReportController {
  constructor(private readonly reports: ReportService) {}

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
    if (error instanceof ReportError) {
      const status =
        error.code === REPORT_ERROR_CODES.EVENT_NOT_FOUND
          ? 404
          : error.code === REPORT_ERROR_CODES.INVALID_CURSOR
            ? 422
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

  @Get('tenants/:tenantId/events/:eventId/report')
  @ApiBearerAuth()
  @ApiOkResponse({ type: EventReportDto })
  report(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.reports
      .eventReport(authorization, tenant, event)
      .catch((error) => this.fail(error));
  }

  @Get('tenants/:tenantId/reports/portfolio')
  @ApiBearerAuth()
  @ApiOkResponse({ type: PortfolioReportDto })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Default 20; hard max 50 (clamped server-side)',
  })
  portfolio(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Query() query: { cursor?: string; limit?: string },
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    return this.reports
      .portfolioReport(authorization, tenant, query ?? {})
      .catch((error) => this.fail(error));
  }

  @Get('tenants/:tenantId/events/:eventId/audit')
  @ApiBearerAuth()
  @ApiOkResponse({ type: PortalAuditPageDto })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'action', required: false })
  audit(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Query()
    query: {
      cursor?: string;
      limit?: string;
      from?: string;
      to?: string;
      action?: string;
    },
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.reports
      .eventAudit(authorization, tenant, event, query ?? {})
      .catch((error) => this.fail(error));
  }
}
