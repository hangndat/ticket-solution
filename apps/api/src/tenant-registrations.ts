import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Headers,
  HttpException,
  Injectable,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import {
  type ApiError,
  type PublicTenantRegistrationBody,
  type PublicTenantRegistrationResponse,
  PLATFORM_ERROR_CODES,
} from '@ticket/contracts';
import {
  IdentityError,
  PlatformError,
  readSelfServeRegistrationConfig,
  registerPendingTenant,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
  type SelfServeRegistrationConfig,
} from '@ticket/backend';
type RequestWithIp = { ip?: string };
import {
  API_RATE_BUCKETS,
  API_RATE_LIMITS,
} from './http-limits';
import { consumeIpRateLimit } from './http-rate-limit';
import { identityErrorHttpStatus } from './identity-http-status';

class PublicTenantRegistrationBodyDto implements PublicTenantRegistrationBody {
  @ApiProperty({ example: 'acme-events' }) slug!: string;
  @ApiProperty({ example: 'Acme Events' }) name!: string;
  @ApiProperty({ required: false, example: 'Asia/Ho_Chi_Minh' })
  defaultTimezone?: string;
  @ApiProperty({ required: false, nullable: true, type: String })
  contact?: string | null;
}

class PublicTenantRegistrationResponseDto
  implements PublicTenantRegistrationResponse
{
  @ApiProperty({ format: 'uuid' }) registrationId!: string;
  @ApiProperty({ format: 'uuid' }) tenantId!: string;
  @ApiProperty({ enum: ['PENDING'] }) status!: 'PENDING';
}

type Deps = {
  db: PrismaClient | null;
  verifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  bootError: IdentityError | PlatformError | null;
  selfServe: SelfServeRegistrationConfig | null;
};

function fail(error: unknown): never {
  if (error instanceof PlatformError) {
    const status =
      error.code === PLATFORM_ERROR_CODES.UNAUTHENTICATED
        ? 401
        : error.code === PLATFORM_ERROR_CODES.PERMISSION_DENIED
          ? 403
          : error.code === PLATFORM_ERROR_CODES.SLUG_TAKEN ||
              error.code === PLATFORM_ERROR_CODES.IDEMPOTENCY_CONFLICT
            ? 409
            : error.code === PLATFORM_ERROR_CODES.RATE_LIMITED
              ? 429
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
  throw error;
}

export function buildTenantRegistrationDeps(input: {
  env: NodeJS.ProcessEnv;
  db: PrismaClient | null;
  verifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  bootError: IdentityError | null;
}): Deps {
  let selfServe: SelfServeRegistrationConfig | null = null;
  let bootError: IdentityError | PlatformError | null = input.bootError;
  if (input.db && !bootError) {
    try {
      selfServe = readSelfServeRegistrationConfig(input.env);
    } catch (error) {
      if (error instanceof PlatformError) {
        bootError = error;
      } else {
        throw error;
      }
    }
  }
  return {
    db: input.db,
    verifier: input.verifier,
    users: input.users,
    bootError,
    selfServe,
  };
}

@Injectable()
export class TenantRegistrationService {
  constructor(private readonly deps: Deps) {}

  private async actor(authorization: string | undefined) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.verifier || !this.deps.users || !this.deps.db) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.DEPENDENCY_UNAVAILABLE,
        'Tenant registration unavailable',
        true,
      );
    }
    if (!authorization?.startsWith('Bearer ')) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.UNAUTHENTICATED,
        'Bearer token required',
      );
    }
    const verified = await this.deps.verifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity(verified);
  }

  async register(
    authorization: string | undefined,
    idempotencyKey: string | undefined,
    body: PublicTenantRegistrationBody,
    clientIp?: string,
  ): Promise<PublicTenantRegistrationResponse> {
    await consumeIpRateLimit(
      this.deps.db,
      clientIp,
      API_RATE_BUCKETS.tenantRegistration,
      API_RATE_LIMITS.tenantRegistrationPerIp,
    );
    return this.actor(authorization)
      .then((u) =>
        registerPendingTenant(this.deps.db!, {
          actorUserId: u.userId,
          email: u.email,
          emailVerified: u.emailVerified,
          clientKey: idempotencyKey,
          body,
          config: this.deps.selfServe ?? undefined,
        }),
      )
      .catch(fail);
  }
}

@ApiTags('public-tenant-registrations')
@Controller('public/tenant-registrations')
export class TenantRegistrationController {
  constructor(private readonly registrations: TenantRegistrationService) {}

  @Post()
  @ApiBearerAuth()
  @ApiHeader({ name: 'idempotency-key', required: true })
  @ApiCreatedResponse({ type: PublicTenantRegistrationResponseDto })
  async create(
    @Req() req: RequestWithIp,
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: PublicTenantRegistrationBodyDto,
  ): Promise<PublicTenantRegistrationResponse> {
    try {
      return await this.registrations.register(
        authorization,
        idempotencyKey,
        body,
        req.ip,
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw error;
    }
  }
}
