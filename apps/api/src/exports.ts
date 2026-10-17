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
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { type ApiError } from '@ticket/contracts';

type ReplyLike = {
  header(name: string, value: string): ReplyLike;
  send(payload: Buffer): unknown;
};
import {
  AuthzError,
  ExportError,
  EXPORT_ERROR_CODES,
  IdentityError,
  IDENTITY_ERROR_CODES,
  createExportJob,
  downloadExport,
  getExportJob,
  parseTtlSeconds,
  readMinioEnvironment,
  requireMinioConfig,
  withTenant,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ExportCreateBodyDto {
  @ApiProperty({ enum: ['csv'] }) format!: 'csv';
  @ApiProperty({ required: false })
  filter?: { states?: string[]; from?: string; to?: string };
}

class ExportJobDto {
  @ApiProperty({ format: 'uuid' }) exportId!: string;
  @ApiProperty({ enum: ['PENDING', 'PROCESSING', 'READY', 'FAILED'] })
  status!: string;
  @ApiProperty({ nullable: true, type: Number }) rowCount!: number | null;
  @ApiProperty({ nullable: true, type: String }) expiresAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) error!: string | null;
  @ApiProperty({ required: false }) replayed?: boolean;
}

type Deps = {
  db: PrismaClient | null;
  verifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  bootError: IdentityError | null;
  env: NodeJS.ProcessEnv;
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
export class ExportApiService {
  constructor(private readonly deps: Deps) {}

  private async actor(authorization: string | undefined) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.verifier || !this.deps.users || !this.deps.db) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Export services are not configured',
      );
    }
    const verified = await this.deps.verifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity(verified);
  }

  async create(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    idempotencyKey: string | undefined,
    body: ExportCreateBodyDto,
  ) {
    if (!readMinioEnvironment(this.deps.env)) {
      throw new ExportError(
        EXPORT_ERROR_CODES.MINIO_MISCONFIGURED,
        'MinIO is not configured',
      );
    }
    const user = await this.actor(authorization);
    if (body.format !== 'csv') {
      throw new ExportError(
        EXPORT_ERROR_CODES.INVALID_FILTER,
        'Only csv format is supported',
      );
    }
    return withTenant(this.deps.db!, tenantId, (tx) =>
      createExportJob(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        clientKey: idempotencyKey ?? '',
        filter: body.filter,
        ttlSeconds: parseTtlSeconds(this.deps.env),
      }),
    );
  }

  async status(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    exportId: string,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      getExportJob(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        exportId,
      }),
    );
  }

  async download(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    exportId: string,
  ) {
    const minio = requireMinioConfig(this.deps.env);
    const user = await this.actor(authorization);
    return downloadExport(this.deps.db!, minio, {
      tenantId,
      eventId,
      actorUserId: user.userId,
      exportId,
    });
  }
}

@ApiTags('exports')
@Controller()
export class ExportController {
  constructor(private readonly exports: ExportApiService) {}

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
    if (error instanceof ExportError) {
      const status =
        error.code === EXPORT_ERROR_CODES.EXPORT_NOT_FOUND ||
        error.code === EXPORT_ERROR_CODES.EVENT_NOT_FOUND
          ? 404
          : error.code === EXPORT_ERROR_CODES.EXPORT_NOT_READY
            ? 409
            : error.code === EXPORT_ERROR_CODES.MINIO_MISCONFIGURED
              ? 503
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

  @Post('tenants/:tenantId/events/:eventId/exports')
  @ApiBearerAuth()
  @ApiHeader({ name: 'idempotency-key', required: true })
  @ApiOkResponse({ type: ExportJobDto })
  create(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: ExportCreateBodyDto,
  ) {
    return this.exports
      .create(
        authorization,
        requireUuid(tenantId, 'tenantId'),
        requireUuid(eventId, 'eventId'),
        idempotencyKey,
        body ?? { format: 'csv' },
      )
      .catch((e) => this.fail(e));
  }

  @Get('tenants/:tenantId/events/:eventId/exports/:exportId')
  @ApiBearerAuth()
  @ApiOkResponse({ type: ExportJobDto })
  status(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Param('exportId') exportId: string,
  ) {
    return this.exports
      .status(
        authorization,
        requireUuid(tenantId, 'tenantId'),
        requireUuid(eventId, 'eventId'),
        requireUuid(exportId, 'exportId'),
      )
      .catch((e) => this.fail(e));
  }

  @Get('tenants/:tenantId/events/:eventId/exports/:exportId/download')
  @ApiBearerAuth()
  async download(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Param('exportId') exportId: string,
    @Res() reply: ReplyLike,
  ) {
    try {
      const file = await this.exports.download(
        authorization,
        requireUuid(tenantId, 'tenantId'),
        requireUuid(eventId, 'eventId'),
        requireUuid(exportId, 'exportId'),
      );
      reply
        .header('Content-Type', file.contentType)
        .header(
          'Content-Disposition',
          `attachment; filename="${file.filename}"`,
        )
        .header('Cache-Control', 'private, no-store')
        .send(file.body);
    } catch (error) {
      this.fail(error);
    }
  }
}
