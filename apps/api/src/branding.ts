import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Injectable,
  Param,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import {
  type ApiError,
  type TenantBranding,
  type TenantBrandingUpdateBody,
} from '@ticket/contracts';
import {
  AuthzError,
  BrandingError,
  BRANDING_ERROR_CODES,
  IdentityError,
  IDENTITY_ERROR_CODES,
  getTenantBranding,
  updateTenantBranding,
  withTenant,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class TenantBrandingDto implements TenantBranding {
  @ApiProperty({ format: 'uuid' }) tenantId!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ example: '#0B3D2E' }) primaryColor!: string;
  @ApiProperty({ nullable: true, type: String }) secondaryColor!: string | null;
  @ApiProperty({ nullable: true, format: 'uuid', type: String })
  logoAssetId!: string | null;
  @ApiProperty() version!: number;
}

class TenantBrandingUpdateDto implements TenantBrandingUpdateBody {
  @ApiProperty({ required: false }) displayName?: string;
  @ApiProperty({ required: false, example: '#0B3D2E' }) primaryColor?: string;
  @ApiProperty({ required: false, nullable: true, type: String })
  secondaryColor?: string | null;
  @ApiProperty({ required: false, nullable: true, format: 'uuid', type: String })
  logoAssetId?: string | null;
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
  if (!value || !UUID.test(value)) throw scopeError(`${name} must be a UUID`);
  return value;
}

@Injectable()
export class BrandingService {
  constructor(private readonly deps: Deps) {}

  private async actor(authorization: string | undefined) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.verifier || !this.deps.users || !this.deps.db) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Branding services are not configured',
      );
    }
    const verified = await this.deps.verifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity(verified);
  }

  async get(
    authorization: string | undefined,
    tenantId: string,
  ): Promise<TenantBranding> {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      getTenantBranding(tx, { tenantId, actorUserId: user.userId }),
    );
  }

  async update(
    authorization: string | undefined,
    tenantId: string,
    body: TenantBrandingUpdateBody,
  ): Promise<TenantBranding> {
    const user = await this.actor(authorization);
    if (
      typeof body?.expectedVersion !== 'number' ||
      !Number.isInteger(body.expectedVersion) ||
      body.expectedVersion < 1
    ) {
      throw new BrandingError(
        BRANDING_ERROR_CODES.INVALID_INPUT,
        'expectedVersion must be a positive integer',
      );
    }
    return withTenant(this.deps.db!, tenantId, (tx) =>
      updateTenantBranding(tx, {
        tenantId,
        actorUserId: user.userId,
        expectedVersion: body.expectedVersion,
        displayName: body.displayName,
        primaryColor: body.primaryColor,
        secondaryColor: body.secondaryColor,
        logoAssetId: body.logoAssetId,
      }),
    );
  }
}

@ApiTags('branding')
@Controller()
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

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
    if (error instanceof BrandingError) {
      const status =
        error.code === BRANDING_ERROR_CODES.TENANT_NOT_FOUND
          ? 404
          : error.code === BRANDING_ERROR_CODES.STALE_VERSION
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

  @Get('tenants/:tenantId/branding')
  @ApiBearerAuth()
  @ApiOkResponse({ type: TenantBrandingDto })
  async getBranding(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
  ): Promise<TenantBrandingDto> {
    try {
      const tenant = requireUuid(tenantId, 'tenantId');
      return await this.branding.get(authorization, tenant);
    } catch (error) {
      this.fail(error);
    }
  }

  @Put('tenants/:tenantId/branding')
  @ApiBearerAuth()
  @ApiOkResponse({ type: TenantBrandingDto })
  async putBranding(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Body() body: TenantBrandingUpdateDto,
  ): Promise<TenantBrandingDto> {
    try {
      const tenant = requireUuid(tenantId, 'tenantId');
      return await this.branding.update(authorization, tenant, body);
    } catch (error) {
      this.fail(error);
    }
  }
}
