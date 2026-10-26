import { randomUUID } from 'node:crypto';
import {
  Controller,
  Get,
  Header,
  Headers,
  HttpException,
  Injectable,
  Logger,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  type ApiError,
  type TenantLimitsUsageReadDto,
} from '@ticket/contracts';
import {
  AuthzError,
  AUTHZ_ERROR_CODES,
  IdentityError,
  IDENTITY_ERROR_CODES,
  authorizeTenantLimitsRead,
  readTenantLimitsUsage,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';
import { identityErrorHttpStatus } from './identity-http-status';
import { ApiErrorDto } from './identity/identity-dtos';
import { API_RATE_BUCKETS, API_RATE_LIMITS } from './http-limits';
import {
  consumeUserRateLimitWithRetryAfter,
  RateLimitedWithRetryAfter,
} from './http-rate-limit';
import { requireUuidParam, validationError } from './http-validation';

class TenantLimitCapsDto {
  @ApiProperty({ nullable: true, type: Number }) maxEvents!: number | null;
  @ApiProperty({ nullable: true, type: Number }) maxStaff!: number | null;
  @ApiProperty({ nullable: true, type: Number }) emailPerDay!: number | null;
  @ApiProperty({ nullable: true, type: Number }) importRowsPerJob!:
    number | null;
}

class TenantLimitUsageDto {
  @ApiProperty() events!: number;
  @ApiProperty() staffActive!: number;
  @ApiProperty() staffPendingInvites!: number;
  @ApiProperty() emailToday!: number;
}

class TenantLimitsUsageReadResponseDto implements TenantLimitsUsageReadDto {
  @ApiProperty({ format: 'uuid' }) tenantId!: string;
  @ApiProperty({ type: TenantLimitCapsDto }) limits!: TenantLimitCapsDto;
  @ApiProperty({ type: TenantLimitUsageDto }) usage!: TenantLimitUsageDto;
  @ApiProperty({ format: 'date-time' }) asOf!: string;
  @ApiProperty({ format: 'date' }) emailUsageDate!: string;
}

type Deps = {
  db: PrismaClient | null;
  verifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  bootError: IdentityError | null;
};

export function assertNoLimitsQuery(rawUrl: string): void {
  if (rawUrl.includes('?')) {
    throw validationError(
      'INVALID_FILTER',
      'This endpoint does not accept query parameters',
    );
  }
}

@Injectable()
export class TenantLimitsService {
  constructor(private readonly deps: Deps) {}

  async read(
    authorization: string | undefined,
    tenantId: string,
    onActor: (userId: string) => void,
  ) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.db || !this.deps.verifier || !this.deps.users) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Tenant limits services are not configured',
      );
    }
    const verified = await this.deps.verifier.verifyBearerToken(authorization);
    const actor = await this.deps.users.upsertFromVerifiedIdentity(verified);
    onActor(actor.userId);
    await authorizeTenantLimitsRead(this.deps.db, tenantId, actor.userId);
    await consumeUserRateLimitWithRetryAfter(
      this.deps.db,
      actor.userId,
      API_RATE_BUCKETS.tenantLimitsRead,
      API_RATE_LIMITS.tenantLimitsReadPerUser,
    );
    const snapshot = await readTenantLimitsUsage(
      this.deps.db,
      tenantId,
      actor.userId,
    );
    if (!snapshot) {
      throw validationError('TENANT_NOT_FOUND', 'Tenant not found', 404);
    }
    return snapshot;
  }
}

@ApiTags('tenant-limits')
@Controller()
export class TenantLimitsController {
  private readonly logger = new Logger(TenantLimitsController.name);
  constructor(private readonly limits: TenantLimitsService) {}

  @Get('tenants/:tenantId/limits')
  @ApiBearerAuth()
  @ApiOkResponse({ type: TenantLimitsUsageReadResponseDto })
  @ApiResponse({ status: 401, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  @ApiResponse({ status: 422, type: ApiErrorDto })
  @ApiResponse({
    status: 429,
    type: ApiErrorDto,
    headers: {
      'Retry-After': {
        description: 'Seconds until the current UTC hour window ends',
        schema: { type: 'integer', minimum: 1 },
      },
    },
  })
  @ApiResponse({ status: 503, type: ApiErrorDto })
  @Header('Cache-Control', 'private, no-store')
  async read(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Req() req: { id: string; raw: { url?: string } },
    @Res({ passthrough: true })
    reply: { header: (name: string, value: string) => void },
  ) {
    let actorUserId: string | null = null;
    let httpStatus = 200;
    try {
      // Inspect the original URL: parsed query objects can collapse duplicate keys.
      assertNoLimitsQuery(req.raw.url ?? '');
      const id = requireUuidParam(tenantId, 'tenantId');
      return await this.limits.read(authorization, id, (userId) => {
        actorUserId = userId;
      });
    } catch (error) {
      if (error instanceof RateLimitedWithRetryAfter) {
        reply.header('Retry-After', String(error.retryAfterSeconds));
        httpStatus = error.getStatus();
        throw error;
      }
      if (error instanceof HttpException) {
        httpStatus = error.getStatus();
        throw error;
      }
      if (error instanceof IdentityError) {
        httpStatus = identityErrorHttpStatus(error.code);
        throw new HttpException(
          {
            code: error.code,
            message: error.message,
            requestId: randomUUID(),
            retryable: error.retryable,
          } satisfies ApiError,
          httpStatus,
        );
      }
      if (error instanceof AuthzError) {
        const hidden = error.code !== AUTHZ_ERROR_CODES.PERMISSION_DENIED;
        httpStatus = hidden ? 404 : 403;
        throw new HttpException(
          {
            code: hidden ? 'TENANT_NOT_FOUND' : error.code,
            message: hidden ? 'Tenant not found' : 'Tenant permission denied',
            requestId: randomUUID(),
            retryable: false,
          } satisfies ApiError,
          httpStatus,
        );
      }
      httpStatus = 503;
      throw new HttpException(
        {
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Tenant limits are temporarily unavailable',
          requestId: randomUUID(),
          retryable: true,
        } satisfies ApiError,
        httpStatus,
      );
    } finally {
      // Fixed fields only: never include headers, query strings, members or emails.
      this.logger.log(
        JSON.stringify({
          action: 'tenant_limits.read',
          requestId: req.id,
          actorUserId,
          tenantId: /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(tenantId)
            ? tenantId
            : null,
          httpStatus,
        }),
      );
    }
  }
}
