/**
 * Public tenant branding (unauthenticated chrome).
 */
import { randomUUID } from 'node:crypto';
import {
  Controller,
  Get,
  HttpException,
  Injectable,
  Param,
  Req,
} from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { ApiError, PublicTenantBranding } from '@ticket/contracts';
import {
  getPublicTenantBranding,
  type PrismaClient,
} from '@ticket/backend';
import {
  API_RATE_BUCKETS,
  API_RATE_LIMITS,
} from './http-limits';
import { consumeIpRateLimit } from './http-rate-limit';

type RequestWithIp = { ip?: string };

class PublicTenantBrandingDto implements PublicTenantBranding {
  @ApiProperty() tenantSlug!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ example: '#0B3D2E' }) primaryColor!: string;
  @ApiProperty({ nullable: true, type: String }) secondaryColor!: string | null;
  @ApiProperty({ nullable: true, format: 'uuid', type: String })
  logoAssetId!: string | null;
  @ApiProperty({ required: false }) logoUrl?: string;
}

type Deps = { db: PrismaClient | null };

function notFound(): HttpException {
  return new HttpException(
    {
      code: 'NOT_FOUND',
      message: 'Not found',
      requestId: randomUUID(),
      retryable: false,
    } satisfies ApiError,
    404,
  );
}

function unavailable(): HttpException {
  return new HttpException(
    {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Database is not configured',
      requestId: randomUUID(),
      retryable: true,
    } satisfies ApiError,
    503,
  );
}

@Injectable()
export class PublicTenantBrandingService {
  constructor(private readonly deps: Deps) {}

  async assertPublicReadRateLimit(clientIp?: string): Promise<void> {
    await consumeIpRateLimit(
      this.deps.db,
      clientIp,
      API_RATE_BUCKETS.publicRead,
      API_RATE_LIMITS.publicReadPerIp,
    );
  }

  async get(tenantSlug: string): Promise<PublicTenantBranding> {
    if (!this.deps.db) throw unavailable();
    const result = await getPublicTenantBranding(this.deps.db, tenantSlug);
    if (!result) throw notFound();
    return result;
  }
}

@ApiTags('public-branding')
@Controller('public/tenants/:tenantSlug/branding')
export class PublicTenantBrandingController {
  constructor(private readonly branding: PublicTenantBrandingService) {}

  @Get()
  @ApiOkResponse({ type: PublicTenantBrandingDto })
  async getBranding(
    @Req() req: RequestWithIp,
    @Param('tenantSlug') tenantSlug: string,
  ): Promise<PublicTenantBrandingDto> {
    await this.branding.assertPublicReadRateLimit(req.ip);
    return this.branding.get(tenantSlug);
  }
}
