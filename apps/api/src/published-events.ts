/**
 * ADR-19 — Nest public published-event catalog (unauthenticated, fail-closed).
 */
import { randomUUID } from 'node:crypto';
import {
  Controller,
  Get,
  HttpException,
  Injectable,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
type RequestWithIp = { ip?: string };
import {
  CURSOR_PAGE_LIMIT,
  type ApiError,
  type PublishedBrand,
  type PublishedEventDetail,
  type PublishedEventListResponse,
  type PublishedEventSummary,
  type PublishedFaqItem,
  type PublishedSection,
  type PublishedTerms,
} from '@ticket/contracts';
import {
  getPublishedEventDetail,
  listPlatformPublishedEvents,
  listPublishedEvents,
  PublishedEventsError,
  PUBLISHED_EVENTS_ERROR_CODES,
  type PrismaClient,
} from '@ticket/backend';
import {
  API_RATE_BUCKETS,
  API_RATE_LIMITS,
} from './http-limits';
import { consumeIpRateLimit } from './http-rate-limit';
import { parseOptionalLimitQuery } from './http-validation';

class PublishedBrandDto implements PublishedBrand {
  @ApiProperty({ example: '#245B47' }) primaryColor!: string;
  @ApiProperty() organizationName!: string;
  @ApiProperty({ required: false }) logoUrl?: string;
  @ApiProperty({ required: false }) bannerUrl?: string;
  @ApiProperty({ required: false }) contact?: string;
}

class PublishedSectionDto implements PublishedSection {
  @ApiProperty() id!: string;
  @ApiProperty({
    enum: ['hero', 'info', 'redeem', 'guide', 'faq', 'terms'],
  })
  kind!: PublishedSection['kind'];
  @ApiProperty() visible!: boolean;
  @ApiProperty() order!: number;
  @ApiProperty({ required: false }) title?: string;
  @ApiProperty({ required: false }) bodyMarkdown?: string;
}

class PublishedFaqItemDto implements PublishedFaqItem {
  @ApiProperty() q!: string;
  @ApiProperty() a!: string;
}

class PublishedTermsDto implements PublishedTerms {
  @ApiProperty() version!: string;
  @ApiProperty() bodyMarkdown!: string;
}

class PublishedEventSummaryDto implements PublishedEventSummary {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) tenantId!: string;
  @ApiProperty() tenantSlug!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty({ nullable: true, type: String }) startsAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) location!: string | null;
  @ApiProperty() publishedConfigVersion!: number;
  @ApiProperty() schemaVersion!: number;
  @ApiProperty({ type: PublishedBrandDto }) brand!: PublishedBrand;
}

class PublishedEventDetailDto
  extends PublishedEventSummaryDto
  implements PublishedEventDetail
{
  @ApiProperty({ type: [PublishedSectionDto] }) sections!: PublishedSection[];
  @ApiProperty({ type: [PublishedFaqItemDto] }) faq!: PublishedFaqItem[];
  @ApiProperty({ nullable: true, type: PublishedTermsDto })
  terms!: PublishedTerms | null;
  @ApiProperty({ required: false, nullable: true, type: Object })
  form?: PublishedEventDetail['form'];
}

class PublishedEventListResponseDto implements PublishedEventListResponse {
  @ApiProperty({ type: [PublishedEventSummaryDto] })
  items!: PublishedEventSummary[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
}

type Deps = {
  db: PrismaClient | null;
};

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

function badRequest(code: string, message: string): HttpException {
  return new HttpException(
    {
      code,
      message,
      requestId: randomUUID(),
      retryable: false,
    } satisfies ApiError,
    400,
  );
}

@Injectable()
export class PublishedEventsService {
  constructor(private readonly deps: Deps) {}

  async assertPublicReadRateLimit(clientIp?: string): Promise<void> {
    await consumeIpRateLimit(
      this.deps.db,
      clientIp,
      API_RATE_BUCKETS.publicRead,
      API_RATE_LIMITS.publicReadPerIp,
    );
  }

  async list(
    tenantSlug: string,
    cursor?: string,
    limit?: number,
  ): Promise<PublishedEventListResponse> {
    if (!this.deps.db) throw unavailable();
    const parsedLimit = limit;
    const result = await listPublishedEvents(this.deps.db, {
      tenantSlug: tenantSlug.trim().toLowerCase(),
      cursor: cursor ?? null,
      limit:
        parsedLimit !== undefined && Number.isFinite(parsedLimit)
          ? parsedLimit
          : undefined,
    });
    if (!result) throw notFound();
    return result;
  }

  async detail(
    tenantSlug: string,
    eventSlug: string,
  ): Promise<PublishedEventDetail> {
    if (!this.deps.db) throw unavailable();
    const result = await getPublishedEventDetail(this.deps.db, {
      tenantSlug: tenantSlug.trim().toLowerCase(),
      eventSlug: eventSlug.trim().toLowerCase(),
    });
    if (!result) throw notFound();
    return result;
  }

  async listPlatform(
    cursor?: string,
    limit?: number,
  ): Promise<PublishedEventListResponse> {
    if (!this.deps.db) throw unavailable();
    const parsedLimit = limit;
    try {
      return await listPlatformPublishedEvents(this.deps.db, {
        cursor: cursor ?? null,
        limit:
          parsedLimit !== undefined && Number.isFinite(parsedLimit)
            ? parsedLimit
            : undefined,
      });
    } catch (error) {
      if (
        error instanceof PublishedEventsError &&
        error.code === PUBLISHED_EVENTS_ERROR_CODES.INVALID_CURSOR
      ) {
        throw badRequest(error.code, error.message);
      }
      throw error;
    }
  }
}

@ApiTags('public-events')
@Controller('public/events')
export class PlatformPublishedEventsController {
  constructor(private readonly published: PublishedEventsService) {}

  @Get()
  @ApiOkResponse({ type: PublishedEventListResponseDto })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: CURSOR_PAGE_LIMIT.min,
    maximum: CURSOR_PAGE_LIMIT.max,
  })
  async list(
    @Req() req: RequestWithIp,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<PublishedEventListResponse> {
    await this.published.assertPublicReadRateLimit(req.ip);
    return this.published.listPlatform(
      cursor,
      parseOptionalLimitQuery(limit),
    );
  }
}

@ApiTags('public-events')
@Controller('public/tenants/:tenantSlug/events')
export class PublishedEventsController {
  constructor(private readonly published: PublishedEventsService) {}

  @Get()
  @ApiOkResponse({ type: PublishedEventListResponseDto })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: CURSOR_PAGE_LIMIT.min,
    maximum: CURSOR_PAGE_LIMIT.max,
  })
  async list(
    @Req() req: RequestWithIp,
    @Param('tenantSlug') tenantSlug: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<PublishedEventListResponse> {
    await this.published.assertPublicReadRateLimit(req.ip);
    return this.published.list(
      tenantSlug,
      cursor,
      parseOptionalLimitQuery(limit),
    );
  }

  @Get(':eventSlug')
  @ApiOkResponse({ type: PublishedEventDetailDto })
  async detail(
    @Req() req: RequestWithIp,
    @Param('tenantSlug') tenantSlug: string,
    @Param('eventSlug') eventSlug: string,
  ): Promise<PublishedEventDetail> {
    await this.published.assertPublicReadRateLimit(req.ip);
    return this.published.detail(tenantSlug, eventSlug);
  }
}
