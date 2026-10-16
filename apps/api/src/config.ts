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
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { type ApiError } from '@ticket/contracts';
import {
  AuthzError,
  ConfigError,
  CONFIG_ERROR_CODES,
  IdentityError,
  IDENTITY_ERROR_CODES,
  publishEventConfig,
  saveEventConfigVersion,
  withTenant,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ConfigBodyDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  payload!: Record<string, unknown>;
  @ApiProperty({ required: false }) schemaVersion?: number;
}

class PublishBodyDto {
  @ApiProperty() expectedVersion!: number;
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

@Injectable()
export class ConfigPublishService {
  constructor(private readonly deps: Deps) {}

  private async actor(authorization: string | undefined) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.db || !this.deps.verifier || !this.deps.users) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Config services are not configured',
      );
    }
    const verified = await this.deps.verifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity(verified);
  }

  async save(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: ConfigBodyDto,
  ) {
    const user = await this.actor(authorization);
    const saved = await withTenant(this.deps.db!, tenantId, (tx) =>
      saveEventConfigVersion(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        schemaVersion: body.schemaVersion,
        payload: body.payload,
      }),
    );
    return {
      ...saved,
      publishedAt: saved.publishedAt ? saved.publishedAt.toISOString() : null,
    };
  }

  async publish(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    expectedVersion: number,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      publishEventConfig(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        expectedVersion,
      }),
    );
  }
}

@ApiTags('config')
@Controller()
export class ConfigPublishController {
  constructor(private readonly configs: ConfigPublishService) {}

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
    if (error instanceof ConfigError) {
      const status =
        error.code === CONFIG_ERROR_CODES.EVENT_NOT_FOUND ||
        error.code === CONFIG_ERROR_CODES.CONFIG_VERSION_NOT_FOUND
          ? 404
          : error.code === CONFIG_ERROR_CODES.CONFIG_VERSION_MISMATCH
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

  @Post('tenants/:tenantId/events/:eventId/config-versions')
  @ApiBearerAuth()
  save(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: ConfigBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    if (!body?.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) {
      throw scopeError('payload object is required');
    }
    return this.configs.save(authorization, tenant, event, body).catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/publish')
  @ApiBearerAuth()
  publish(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: PublishBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    if (!Number.isInteger(body?.expectedVersion) || body.expectedVersion < 1) {
      throw scopeError('expectedVersion must be a positive integer');
    }
    return this.configs
      .publish(authorization, tenant, event, body.expectedVersion)
      .catch((error) => this.fail(error));
  }
}
