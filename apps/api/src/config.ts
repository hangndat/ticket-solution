import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Injectable,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import {
  ASSET_LIMITS,
  type ApiError,
  type AssetUploadInitBody,
  type ConfigRollbackBody,
} from '@ticket/contracts';
import {
  AuthzError,
  ConfigError,
  CONFIG_ERROR_CODES,
  IdentityError,
  IDENTITY_ERROR_CODES,
  createMinioObjectStore,
  finalizeEventAssetUpload,
  initEventAssetUpload,
  listEventConfigVersions,
  previewEventConfigVersion,
  publishEventConfig,
  readMinioEnvironment,
  rollbackEventConfig,
  saveEventConfigVersion,
  withTenant,
  type IdentityUserRepository,
  type ObjectStore,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';
import { identityErrorHttpStatus } from './identity-http-status';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ConfigBodyDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  payload!: Record<string, unknown>;
  @ApiProperty({ required: false }) schemaVersion?: number;
  /** Latest draft version the caller read; 0 before the first save. Omitted keeps legacy unconditional-save semantics. */
  @ApiProperty({ required: false }) expectedVersion?: number;
}

class PublishBodyDto {
  @ApiProperty() expectedVersion!: number;
}

class RollbackBodyDto implements ConfigRollbackBody {
  @ApiProperty() targetVersion!: number;
  @ApiProperty() expectedPublishedVersion!: number;
  @ApiProperty() expectedRevision!: number;
}

class AssetInitBodyDto implements AssetUploadInitBody {
  @ApiProperty() filename!: string;
  @ApiProperty({ enum: ASSET_LIMITS.allowedMime })
  contentType!: AssetUploadInitBody['contentType'];
  @ApiProperty() byteLength!: number;
}

class AssetFinalizeBodyDto {
  @ApiProperty({ format: 'uuid' }) assetId!: string;
}

type Deps = {
  db: PrismaClient | null;
  verifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  bootError: IdentityError | null;
  objectStore?: ObjectStore | null;
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

function resolveObjectStore(deps: Deps): ObjectStore {
  if (deps.objectStore) return deps.objectStore;
  const cfg = readMinioEnvironment(process.env);
  if (!cfg) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.MINIO_MISCONFIGURED,
      'MinIO is not configured',
    );
  }
  return createMinioObjectStore(cfg);
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
        expectedVersion: body.expectedVersion,
      }),
    );
    return {
      ...saved,
      publishedAt: saved.publishedAt ? saved.publishedAt.toISOString() : null,
    };
  }

  async list(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    cursor?: string,
    limit?: number,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      listEventConfigVersions(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        cursor,
        limit,
      }),
    );
  }

  async preview(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    version: number,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      previewEventConfigVersion(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        version,
      }),
    );
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

  async rollback(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: ConfigRollbackBody,
    idempotencyKey: string | undefined,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      rollbackEventConfig(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        targetVersion: body.targetVersion,
        expectedPublishedVersion: body.expectedPublishedVersion,
        expectedRevision: body.expectedRevision,
        idempotencyKey: idempotencyKey ?? '',
      }),
    );
  }

  async assetInit(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: AssetUploadInitBody,
  ) {
    const user = await this.actor(authorization);
    const store = resolveObjectStore(this.deps);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      initEventAssetUpload(tx, store, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        body,
      }),
    );
  }

  async assetFinalize(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    assetId: string,
  ) {
    const user = await this.actor(authorization);
    const store = resolveObjectStore(this.deps);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      finalizeEventAssetUpload(tx, store, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        assetId,
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
    if (error instanceof ConfigError) {
      const status =
        error.code === CONFIG_ERROR_CODES.EVENT_NOT_FOUND ||
        error.code === CONFIG_ERROR_CODES.CONFIG_VERSION_NOT_FOUND ||
        error.code === CONFIG_ERROR_CODES.ASSET_NOT_FOUND
          ? 404
          : error.code === CONFIG_ERROR_CODES.CONFIG_VERSION_MISMATCH ||
              error.code === CONFIG_ERROR_CODES.REVISION_CONFLICT ||
              error.code === CONFIG_ERROR_CODES.IDEMPOTENCY_CONFLICT ||
              error.code === CONFIG_ERROR_CODES.ALREADY_PUBLISHED
            ? 409
            : error.code === CONFIG_ERROR_CODES.MINIO_MISCONFIGURED
              ? 503
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
    if (
      !body?.payload ||
      typeof body.payload !== 'object' ||
      Array.isArray(body.payload)
    ) {
      throw scopeError('payload object is required');
    }
    if (
      body.expectedVersion !== undefined &&
      (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 0)
    ) {
      throw scopeError('expectedVersion must be a non-negative integer');
    }
    return this.configs
      .save(authorization, tenant, event, body)
      .catch((error) => this.fail(error));
  }

  @Get('tenants/:tenantId/events/:eventId/config-versions')
  @ApiBearerAuth()
  list(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    let limit: number | undefined;
    if (limitRaw !== undefined && limitRaw !== '') {
      const parsed = Number.parseInt(limitRaw, 10);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw scopeError('limit must be a positive integer');
      }
      limit = parsed;
    }
    return this.configs
      .list(authorization, tenant, event, cursor, limit)
      .catch((error) => this.fail(error));
  }

  @Get('tenants/:tenantId/events/:eventId/config-versions/:version/preview')
  @ApiBearerAuth()
  preview(
    @Headers('authorization') authorization: string | undefined,
    @Headers('cache-control') _cacheControl: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Param('version') versionRaw: string,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    const version = Number.parseInt(versionRaw, 10);
    if (!Number.isInteger(version) || version < 1) {
      throw scopeError('version must be a positive integer');
    }
    return this.configs
      .preview(authorization, tenant, event, version)
      .catch((error) => this.fail(error));
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

  @Post('tenants/:tenantId/events/:eventId/config/rollback')
  @ApiBearerAuth()
  rollback(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: RollbackBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    if (!Number.isInteger(body?.targetVersion) || body.targetVersion < 1) {
      throw scopeError('targetVersion must be a positive integer');
    }
    if (
      !Number.isInteger(body?.expectedPublishedVersion) ||
      body.expectedPublishedVersion < 1
    ) {
      throw scopeError('expectedPublishedVersion must be a positive integer');
    }
    if (!Number.isInteger(body?.expectedRevision) || body.expectedRevision < 1) {
      throw scopeError('expectedRevision must be a positive integer');
    }
    return this.configs
      .rollback(authorization, tenant, event, body, idempotencyKey)
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/assets/upload-init')
  @ApiBearerAuth()
  assetInit(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: AssetInitBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.configs
      .assetInit(authorization, tenant, event, body)
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/assets/finalize')
  @ApiBearerAuth()
  assetFinalize(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: AssetFinalizeBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    const assetId = requireUuid(body?.assetId, 'assetId');
    return this.configs
      .assetFinalize(authorization, tenant, event, assetId)
      .catch((error) => this.fail(error));
  }
}
