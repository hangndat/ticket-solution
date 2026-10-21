import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { parseOptionalLimitQuery, requireUuidParam } from '../http-validation';
import {
  PortalPlatformAuditPageDto,
  PortalPlatformTenantHealthDto,
  PortalPlatformTenantsPageDto,
  PortalReasonBodyDto,
  SupportGrantRevokeResponseDto,
} from './platform-dtos';
import { PlatformService } from './platform.service';

@ApiTags('platform')
@Controller()
export class PlatformOperatorController {
  constructor(private readonly platform: PlatformService) {}

  @Get('platform/audit')
  @ApiBearerAuth()
  @ApiOkResponse({ type: PortalPlatformAuditPageDto })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  listAudit(
    @Headers('authorization') authorization: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('action') action?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.platform.listAudit(authorization, {
      cursor,
      limit: parseOptionalLimitQuery(limit),
      from,
      to,
      action,
      tenantId: tenantId ? requireUuidParam(tenantId, 'tenantId') : undefined,
    });
  }

  @Get('platform/tenants')
  @ApiBearerAuth()
  @ApiOkResponse({ type: PortalPlatformTenantsPageDto })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listTenants(
    @Headers('authorization') authorization: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.platform.listTenants(authorization, {
      cursor,
      limit: parseOptionalLimitQuery(limit),
    });
  }

  @Post('platform/tenants')
  @ApiBearerAuth()
  createTenant(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.platform.createTenant(authorization, idempotencyKey, body ?? {});
  }

  @Get('platform/tenants/:tenantId')
  @ApiBearerAuth()
  tenantDetail(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
  ) {
    return this.platform.tenantDetail(
      authorization,
      requireUuidParam(tenantId, 'tenantId'),
    );
  }

  @Get('platform/tenants/:tenantId/health')
  @ApiBearerAuth()
  @ApiOkResponse({ type: PortalPlatformTenantHealthDto })
  tenantHealth(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
  ) {
    return this.platform.tenantHealth(
      authorization,
      requireUuidParam(tenantId, 'tenantId'),
    );
  }

  @Post('platform/tenants/:tenantId/status')
  @ApiBearerAuth()
  setStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Body() body: { status: 'ACTIVE' | 'SUSPENDED'; reason: string; expectedVersion: number },
  ) {
    return this.platform.setStatus(
      authorization,
      requireUuidParam(tenantId, 'tenantId'),
      body,
    );
  }

  @Put('platform/tenants/:tenantId/limits')
  @ApiBearerAuth()
  setLimits(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Body() body: never,
  ) {
    return this.platform.setLimits(
      authorization,
      requireUuidParam(tenantId, 'tenantId'),
      body,
    );
  }

  @Post('platform/support-grants')
  @ApiBearerAuth()
  supportGrant(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: never,
  ) {
    return this.platform.supportGrant(authorization, body);
  }

  @Post('platform/support-grants/:grantId/revoke')
  @ApiBearerAuth()
  @ApiBody({ type: PortalReasonBodyDto })
  @ApiOkResponse({ type: SupportGrantRevokeResponseDto })
  revokeSupportGrant(
    @Headers('authorization') authorization: string | undefined,
    @Param('grantId') grantId: string,
    @Body() body: PortalReasonBodyDto,
  ) {
    return this.platform.revokeSupportGrant(authorization, grantId, body);
  }

  @Get('platform/support-grants/:grantId/tickets')
  @ApiBearerAuth()
  supportTickets(
    @Headers('authorization') authorization: string | undefined,
    @Param('grantId') grantId: string,
  ) {
    return this.platform.supportTickets(authorization, '', grantId);
  }
}
