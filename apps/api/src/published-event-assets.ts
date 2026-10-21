/**
 * Public GET for published event raster assets (MinIO proxy).
 */
import { randomUUID } from 'node:crypto';
import {
  Controller,
  Get,
  Header,
  HttpException,
  Injectable,
  Param,
  Req,
  StreamableFile,
} from '@nestjs/common';
import { ApiProduces, ApiTags } from '@nestjs/swagger';
import type { ApiError } from '@ticket/contracts';
import {
  readPublishedEventAsset,
  type PrismaClient,
} from '@ticket/backend';
import {
  API_RATE_BUCKETS,
  API_RATE_LIMITS,
} from './http-limits';
import { consumeIpRateLimit } from './http-rate-limit';

type RequestWithIp = { ip?: string };

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
export class PublishedEventAssetsService {
  constructor(private readonly deps: Deps) {}

  async assertPublicReadRateLimit(clientIp?: string): Promise<void> {
    await consumeIpRateLimit(
      this.deps.db,
      clientIp,
      API_RATE_BUCKETS.publicRead,
      API_RATE_LIMITS.publicReadPerIp,
    );
  }

  async stream(
    tenantSlug: string,
    eventSlug: string,
    assetId: string,
  ): Promise<{ body: Buffer; contentType: string; cacheControl: string }> {
    if (!this.deps.db) throw unavailable();
    const result = await readPublishedEventAsset(this.deps.db, {
      tenantSlug,
      eventSlug,
      assetId,
    });
    if (!result.ok) throw notFound();
    return {
      body: result.body,
      contentType: result.contentType,
      cacheControl: result.cacheControl,
    };
  }
}

@ApiTags('public-events')
@Controller('public/tenants/:tenantSlug/events/:eventSlug/assets')
export class PublishedEventAssetsController {
  constructor(private readonly assets: PublishedEventAssetsService) {}

  @Get(':assetId')
  @ApiProduces('image/png', 'image/jpeg', 'image/webp')
  @Header('Cache-Control', 'public, max-age=300')
  async getAsset(
    @Req() req: RequestWithIp,
    @Param('tenantSlug') tenantSlug: string,
    @Param('eventSlug') eventSlug: string,
    @Param('assetId') assetId: string,
  ): Promise<StreamableFile> {
    await this.assets.assertPublicReadRateLimit(req.ip);
    const file = await this.assets.stream(tenantSlug, eventSlug, assetId);
    return new StreamableFile(file.body, { type: file.contentType });
  }
}
