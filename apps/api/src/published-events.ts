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
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import {
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
  listPublishedEvents,
  type PrismaClient,
} from '@ticket/backend';

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

@Injectable()
export class PublishedEventsService {
  constructor(private readonly deps: Deps) {}

  async list(
    tenantSlug: string,
    cursor?: string,
    limit?: string,
  ): Promise<PublishedEventListResponse> {
    if (!this.deps.db) throw unavailable();
    const parsedLimit =
      limit !== undefined && limit !== ''
        ? Number.parseInt(limit, 10)
        : undefined;
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
}

@ApiTags('public-events')
@Controller('public/tenants/:tenantSlug/events')
export class PublishedEventsController {
  constructor(private readonly published: PublishedEventsService) {}

  @Get()
  @ApiOkResponse({ type: PublishedEventListResponseDto })
  async list(
    @Param('tenantSlug') tenantSlug: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<PublishedEventListResponse> {
    return this.published.list(tenantSlug, cursor, limit);
  }

  @Get(':eventSlug')
  @ApiOkResponse({ type: PublishedEventDetailDto })
  async detail(
    @Param('tenantSlug') tenantSlug: string,
    @Param('eventSlug') eventSlug: string,
  ): Promise<PublishedEventDetail> {
    return this.published.detail(tenantSlug, eventSlug);
  }
}
