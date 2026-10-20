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
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOkResponse,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { type ApiError, type ImportKind } from '@ticket/contracts';
import {
  AuthzError,
  IdentityError,
  IDENTITY_ERROR_CODES,
  ImportError,
  IMPORT_ERROR_CODES,
  importErrorHttpStatus,
  InventoryError,
  INVENTORY_ERROR_CODES,
  claimGuestInvitation,
  commitImportJob,
  createImportJob,
  createMemoryObjectStore,
  createMinioObjectStore,
  dispatchGuestInvitations,
  downloadImportErrors,
  getImportJob,
  importRedemptionCodes,
  readRoutingFingerprintSecret,
  readSupportedPepperConfigs,
  listEventCodes,
  listGuestInvitations,
  previewImportJob,
  previewInvitationDispatch,
  readEventQuota,
  readMinioImportsEnvironment,
  uploadImportFile,
  withTenant,
  type CodeHmacConfig,
  type IdentityUserRepository,
  type ObjectStore,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';
import { identityErrorHttpStatus } from './identity-http-status';

/** Minimal multipart surface from @fastify/multipart (avoid direct fastify dep). */
type MultipartRequest = {
  file: () => Promise<
    | {
        filename: string;
        mimetype: string;
        file: AsyncIterable<Buffer>;
        fields: Record<string, { value?: string }>;
      }
    | undefined
  >;
};

type CsvReply = {
  header: (name: string, value: string) => CsvReply;
  send: (body: string) => void;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ImportBodyDto {
  @ApiProperty({ type: [String], required: false }) codes?: string[];
  @ApiProperty({ required: false }) eventQuota?: number;
  @ApiProperty({ required: false, enum: ['CODES', 'GUESTS'] }) kind?: ImportKind;
  @ApiProperty({ required: false }) sourceId?: string;
  @ApiProperty({ required: false }) ticketTypeId?: string;
  @ApiProperty({ required: false }) fileId?: string;
  @ApiProperty({ required: false, type: [String] }) rawCodes?: string[];
  @ApiProperty({ required: false }) mappingRevision?: number;
  @ApiProperty({ required: false }) columnMapping?: {
    code?: string;
    email?: string;
  };
}

class ImportPreviewBodyDto {
  @ApiProperty({ required: false }) mappingRevision?: number;
  @ApiProperty({ required: false }) columnMapping?: {
    code?: string;
    email?: string;
  };
}

class ImportCommitBodyDto {
  @ApiProperty() previewRevision!: number;
  @ApiProperty() mappingRevision!: number;
  @ApiProperty() fileHash!: string;
}

class InvitationDispatchPreviewBodyDto {
  @ApiProperty({ type: [String] }) invitationIds!: string[];
}

class InvitationDispatchBodyDto {
  @ApiProperty({ type: [String] }) invitationIds!: string[];
  @ApiProperty() previewRevision!: number;
}

class InvitationClaimBodyDto {
  @ApiProperty() token!: string;
  @ApiProperty({ required: false }) formVersion?: string;
  @ApiProperty({ required: false }) termsVersion?: string;
  @ApiProperty({ required: false }) answers?: Record<string, string | boolean>;
  @ApiProperty({ required: false }) termsAccepted?: true;
}

class PortalCodeSummaryDto {
  @ApiProperty({ format: 'uuid' }) codeId!: string;
  @ApiProperty({ enum: ['AVAILABLE', 'HELD', 'CONSUMED'] })
  state!: 'AVAILABLE' | 'HELD' | 'CONSUMED';
  @ApiProperty({ format: 'uuid' }) sourceId!: string;
  @ApiProperty({ format: 'uuid' }) ticketTypeId!: string;
}

class PortalCodesPageDto {
  @ApiProperty({ type: [PortalCodeSummaryDto] }) items!: PortalCodeSummaryDto[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
}

type Deps = {
  db: PrismaClient | null;
  verifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  bootError: IdentityError | null;
  hmac: CodeHmacConfig | null;
  credentialKey?: string | null;
  env?: NodeJS.ProcessEnv;
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

function resolveStore(deps: Deps): ObjectStore {
  if (deps.objectStore) return deps.objectStore;
  const cfg = readMinioImportsEnvironment(deps.env ?? process.env);
  if (cfg) return createMinioObjectStore(cfg);
  // Fail closed for real uploads unless tests inject a store.
  throw new ImportError(
    IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
    'Import object store is not configured',
    503,
  );
}

@Injectable()
export class InventoryService {
  constructor(private readonly deps: Deps) {}

  private async actor(authorization: string | undefined) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.db || !this.deps.verifier || !this.deps.users || !this.deps.hmac) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Inventory services are not configured',
      );
    }
    const verified = await this.deps.verifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity(verified);
  }

  async importCodes(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: ImportBodyDto,
  ) {
    const user = await this.actor(authorization);
    let routingRegistry: { peppers: CodeHmacConfig[]; fpSecret: string } | undefined;
    try {
      const env = this.deps.env ?? process.env;
      routingRegistry = {
        peppers: readSupportedPepperConfigs(env),
        fpSecret: readRoutingFingerprintSecret(env),
      };
    } catch {
      routingRegistry = undefined;
    }
    return withTenant(this.deps.db!, tenantId, (tx) =>
      importRedemptionCodes(tx, this.deps.hmac!, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        rawCodes: body.codes ?? [],
        eventQuota: body.eventQuota,
        routingRegistry,
      }),
    );
  }

  async createJob(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: ImportBodyDto,
    idempotencyKey: string | undefined,
  ) {
    const user = await this.actor(authorization);
    if (!body.kind) throw scopeError('kind is required for import jobs');
    return createImportJob(this.deps.db!, {
      tenantId,
      eventId,
      actorUserId: user.userId,
      idempotencyKey: idempotencyKey ?? '',
      body: {
        kind: body.kind,
        sourceId: body.sourceId ?? '',
        ticketTypeId: body.ticketTypeId ?? '',
        fileId: body.fileId,
        rawCodes: body.rawCodes,
        mappingRevision: body.mappingRevision,
        columnMapping: body.columnMapping,
      },
    });
  }

  async uploadFile(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    kind: ImportKind,
    filename: string,
    contentType: string | undefined,
    body: Buffer,
  ) {
    const user = await this.actor(authorization);
    return uploadImportFile(this.deps.db!, resolveStore(this.deps), {
      tenantId,
      eventId,
      actorUserId: user.userId,
      kind,
      filename,
      contentType,
      body,
    });
  }

  async getJob(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    importId: string,
  ) {
    const user = await this.actor(authorization);
    return getImportJob(this.deps.db!, {
      tenantId,
      eventId,
      actorUserId: user.userId,
      importId,
    });
  }

  async preview(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    importId: string,
    body: ImportPreviewBodyDto,
  ) {
    const user = await this.actor(authorization);
    return previewImportJob(this.deps.db!, resolveStore(this.deps), {
      tenantId,
      eventId,
      actorUserId: user.userId,
      importId,
      body,
    });
  }

  async commit(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    importId: string,
    body: ImportCommitBodyDto,
    idempotencyKey: string | undefined,
  ) {
    const user = await this.actor(authorization);
    return commitImportJob(
      this.deps.db!,
      resolveStore(this.deps),
      this.deps.hmac!,
      {
        tenantId,
        eventId,
        actorUserId: user.userId,
        importId,
        body,
        idempotencyKey: idempotencyKey ?? '',
      },
    );
  }

  async errors(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    importId: string,
  ) {
    const user = await this.actor(authorization);
    return downloadImportErrors(this.deps.db!, {
      tenantId,
      eventId,
      actorUserId: user.userId,
      importId,
    });
  }

  async listInvitations(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    cursor: string | undefined,
    limit: string | undefined,
    state: string | undefined,
  ) {
    const user = await this.actor(authorization);
    return listGuestInvitations(this.deps.db!, {
      tenantId,
      eventId,
      actorUserId: user.userId,
      cursor,
      limit: limit ? Number(limit) : undefined,
      state: state as
        | 'PENDING'
        | 'DISPATCHED'
        | 'CLAIMED'
        | 'EXPIRED'
        | 'REVOKED'
        | undefined,
    });
  }

  async dispatchPreview(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: InvitationDispatchPreviewBodyDto,
  ) {
    const user = await this.actor(authorization);
    return previewInvitationDispatch(this.deps.db!, {
      tenantId,
      eventId,
      actorUserId: user.userId,
      body,
    });
  }

  async dispatch(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: InvitationDispatchBodyDto,
    idempotencyKey: string | undefined,
  ) {
    const user = await this.actor(authorization);
    return dispatchGuestInvitations(this.deps.db!, {
      tenantId,
      eventId,
      actorUserId: user.userId,
      body,
      idempotencyKey: idempotencyKey ?? '',
    });
  }

  async claim(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: InvitationClaimBodyDto,
    idempotencyKey: string | undefined,
  ) {
    const user = await this.actor(authorization);
    if (!this.deps.credentialKey) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Credential key is not configured',
      );
    }
    const outcome = await claimGuestInvitation(
      this.deps.db!,
      this.deps.hmac!,
      this.deps.credentialKey,
      {
        tenantId,
        eventId,
        actorUserId: user.userId,
        actorEmail: user.email,
        emailVerified: user.emailVerified,
        body,
        idempotencyKey: idempotencyKey ?? '',
      },
    );
    if (outcome.ok === true) return outcome.result;
    if (outcome.ok === 'pending') return outcome.result;
    throw new ImportError(
      IMPORT_ERROR_CODES.INVITATION_TOKEN_INVALID,
      outcome.rejection.message,
      422,
    );
  }

  async quota(authorization: string | undefined, tenantId: string, eventId: string) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      readEventQuota(tx, { tenantId, eventId, actorUserId: user.userId }),
    );
  }

  async listCodes(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    query: {
      cursor?: string;
      limit?: string;
      state?: string;
      sourceId?: string;
      ticketTypeId?: string;
      q?: string;
    },
  ) {
    const user = await this.actor(authorization);
    const limit = query.limit ? Number(query.limit) : undefined;
    return withTenant(this.deps.db!, tenantId, (tx) =>
      listEventCodes(tx, this.deps.hmac!, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        cursor: query.cursor,
        limit: Number.isFinite(limit) ? limit : undefined,
        state: query.state as 'AVAILABLE' | 'HELD' | 'CONSUMED' | undefined,
        sourceId: query.sourceId,
        ticketTypeId: query.ticketTypeId,
        q: query.q,
      }),
    );
  }
}

@ApiTags('inventory')
@Controller()
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

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
    if (error instanceof ImportError) {
      throw new HttpException(
        {
          code: error.code,
          message: error.message,
          requestId: randomUUID(),
          retryable: false,
        } satisfies ApiError,
        error.httpStatus || importErrorHttpStatus(error.code),
      );
    }
    if (error instanceof InventoryError) {
      const status =
        error.code === INVENTORY_ERROR_CODES.EVENT_NOT_FOUND
          ? 404
          : error.code === INVENTORY_ERROR_CODES.CODE_DUPLICATE
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

  @Post('tenants/:tenantId/events/:eventId/imports/files')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  async uploadFile(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Req() req: MultipartRequest,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    try {
      const file = await req.file();
      if (!file) throw scopeError('multipart file is required');
      // kind may arrive as a multipart field sibling; also accept query-less body field.
      const kindField =
        file.fields?.kind?.value?.trim() ||
        (file.fields as Record<string, { value?: string }> | undefined)?.[
          'kind'
        ]?.value?.trim() ||
        '';
      if (kindField !== 'CODES' && kindField !== 'GUESTS') {
        throw scopeError('kind must be CODES or GUESTS');
      }
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of file.file) {
        total += chunk.length;
        if (total > 10 * 1024 * 1024) {
          throw new ImportError(
            IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
            'CSV exceeds 10 MiB',
          );
        }
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const body = Buffer.concat(chunks);
      return await this.inventory.uploadFile(
        authorization,
        tenant,
        event,
        kindField,
        file.filename || 'import.csv',
        file.mimetype,
        body,
      );
    } catch (error) {
      this.fail(error);
    }
  }

  @Post('tenants/:tenantId/events/:eventId/imports')
  @ApiBearerAuth()
  importOrCreate(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: ImportBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    if (body?.kind) {
      return this.inventory
        .createJob(authorization, tenant, event, body, idempotencyKey)
        .catch((error) => this.fail(error));
    }
    if (!Array.isArray(body?.codes)) throw scopeError('codes must be a list');
    return this.inventory
      .importCodes(authorization, tenant, event, body)
      .catch((error) => this.fail(error));
  }

  @Get('tenants/:tenantId/events/:eventId/imports/:importId')
  @ApiBearerAuth()
  getJob(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Param('importId') importId: string,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    const id = requireUuid(importId, 'importId');
    return this.inventory
      .getJob(authorization, tenant, event, id)
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/imports/:importId/preview')
  @ApiBearerAuth()
  preview(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Param('importId') importId: string,
    @Body() body: ImportPreviewBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    const id = requireUuid(importId, 'importId');
    return this.inventory
      .preview(authorization, tenant, event, id, body ?? {})
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/imports/:importId/commit')
  @ApiBearerAuth()
  commit(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Param('importId') importId: string,
    @Body() body: ImportCommitBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    const id = requireUuid(importId, 'importId');
    return this.inventory
      .commit(authorization, tenant, event, id, body, idempotencyKey)
      .catch((error) => this.fail(error));
  }

  @Get('tenants/:tenantId/events/:eventId/imports/:importId/errors')
  @ApiBearerAuth()
  async errors(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Param('importId') importId: string,
    @Res() reply: CsvReply,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    const id = requireUuid(importId, 'importId');
    try {
      const report = await this.inventory.errors(
        authorization,
        tenant,
        event,
        id,
      );
      reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Cache-Control', 'no-store')
        .header('X-Error-Report-Expires-At', report.expiresAt)
        .send(report.csv);
    } catch (error) {
      this.fail(error);
    }
  }

  @Get('tenants/:tenantId/events/:eventId/invitations')
  @ApiBearerAuth()
  listInvitations(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('state') state?: string,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.inventory
      .listInvitations(authorization, tenant, event, cursor, limit, state)
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/invitations/dispatch-preview')
  @ApiBearerAuth()
  dispatchPreview(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: InvitationDispatchPreviewBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.inventory
      .dispatchPreview(authorization, tenant, event, body)
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/invitations/dispatch')
  @ApiBearerAuth()
  dispatch(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: InvitationDispatchBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.inventory
      .dispatch(authorization, tenant, event, body, idempotencyKey)
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/invitations/claim')
  @ApiBearerAuth()
  claim(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: InvitationClaimBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.inventory
      .claim(authorization, tenant, event, body, idempotencyKey)
      .catch((error) => this.fail(error));
  }

  @Get('tenants/:tenantId/events/:eventId/quota')
  @ApiBearerAuth()
  quota(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.inventory.quota(authorization, tenant, event).catch((error) => this.fail(error));
  }

  @Get('tenants/:tenantId/events/:eventId/codes')
  @ApiBearerAuth()
  @ApiOkResponse({ type: PortalCodesPageDto })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({
    name: 'state',
    required: false,
    enum: ['AVAILABLE', 'HELD', 'CONSUMED'],
  })
  @ApiQuery({ name: 'sourceId', required: false })
  @ApiQuery({ name: 'ticketTypeId', required: false })
  @ApiQuery({ name: 'q', required: false })
  listCodes(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Query()
    query: {
      cursor?: string;
      limit?: string;
      state?: string;
      sourceId?: string;
      ticketTypeId?: string;
      q?: string;
    },
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    return this.inventory
      .listCodes(authorization, tenant, event, query ?? {})
      .catch((error) => this.fail(error));
  }
}

/** Test helper — memory store when MinIO is unset. */
export function memoryImportStoreForTests(): ObjectStore {
  return createMemoryObjectStore();
}
