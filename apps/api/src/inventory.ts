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
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { type ApiError } from '@ticket/contracts';
import {
  AuthzError,
  IdentityError,
  IDENTITY_ERROR_CODES,
  InventoryError,
  INVENTORY_ERROR_CODES,
  importRedemptionCodes,
  readEventQuota,
  withTenant,
  type CodeHmacConfig,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ImportBodyDto {
  @ApiProperty({ type: [String] }) codes!: string[];
  @ApiProperty({ required: false }) eventQuota?: number;
}

type Deps = {
  db: PrismaClient | null;
  verifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  bootError: IdentityError | null;
  hmac: CodeHmacConfig | null;
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
    return withTenant(this.deps.db!, tenantId, (tx) =>
      importRedemptionCodes(tx, this.deps.hmac!, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        rawCodes: body.codes,
        eventQuota: body.eventQuota,
      }),
    );
  }

  async quota(authorization: string | undefined, tenantId: string, eventId: string) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      readEventQuota(tx, { tenantId, eventId, actorUserId: user.userId }),
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

  @Post('tenants/:tenantId/events/:eventId/imports')
  @ApiBearerAuth()
  importCodes(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: ImportBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    if (!Array.isArray(body?.codes)) throw scopeError('codes must be a list');
    return this.inventory
      .importCodes(authorization, tenant, event, body)
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
}
