import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { parseOptionalLimitQuery, requireUuidParam } from '../http-validation';
import {
  CreateInviteBodyDto,
  CreateRolePresetBodyDto,
  InviteRolePresetDto,
  MeEventsDto,
  PortalAssignmentBodyDto,
  PortalInviteRevokeResponseDto,
  PortalInviteResendResponseDto,
  PortalInvitesPageDto,
  PortalMemberRoleBodyDto,
  PortalMembersPageDto,
  PortalMembershipMutationResponseDto,
  PortalPlatformAuditPageDto,
  PortalPlatformTenantHealthDto,
  PortalPlatformTenantsPageDto,
  PortalReasonBodyDto,
  RolePresetDtoSchema,
  RolePresetsListDto,
  SupportGrantRevokeResponseDto,
} from './platform-dtos';
import { PlatformService } from './platform.service';

@ApiTags('platform')
@ApiExtraModels(InviteRolePresetDto, CreateInviteBodyDto, RolePresetDtoSchema)
@Controller()
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('platform/me')
  @ApiBearerAuth()
  platformMe(@Headers('authorization') authorization: string | undefined) {
    return this.platform.me(authorization);
  }

  @Get('me/tenants')
  @ApiBearerAuth()
  myTenants(@Headers('authorization') authorization: string | undefined) {
    return this.platform.myTenants(authorization);
  }

  @Get('me/events')
  @ApiBearerAuth()
  @ApiOkResponse({ type: MeEventsDto })
  myEvents(@Headers('authorization') authorization: string | undefined) {
    return this.platform.myEvents(authorization);
  }

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

  @Get('tenants/:tenantId/members')
  @ApiBearerAuth()
  @ApiOkResponse({ type: PortalMembersPageDto })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'includeRevoked', required: false })
  listMembers(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('includeRevoked') includeRevoked?: string,
  ) {
    return this.platform.listMembers(
      authorization,
      requireUuidParam(tenantId, 'tenantId'),
      {
        cursor,
        limit: parseOptionalLimitQuery(limit),
        includeRevoked,
      },
    );
  }

  @Get('tenants/:tenantId/invites')
  @ApiBearerAuth()
  @ApiOkResponse({ type: PortalInvitesPageDto })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'state', required: false, enum: ['PENDING', 'USED', 'REVOKED', 'EXPIRED'] })
  listInvites(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('state') state?: string,
  ) {
    return this.platform.listInvites(
      authorization,
      requireUuidParam(tenantId, 'tenantId'),
      {
        cursor,
        limit: parseOptionalLimitQuery(limit),
        state,
      },
    );
  }

  @Post('tenants/:tenantId/invites')
  @ApiBearerAuth()
  @ApiBody({ type: CreateInviteBodyDto })
  invite(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('tenantId') tenantId: string,
    @Body() body: CreateInviteBodyDto & Record<string, unknown>,
  ) {
    return this.platform.invite(
      authorization,
      requireUuidParam(tenantId, 'tenantId'),
      idempotencyKey,
      body,
    );
  }

  @Get('tenants/:tenantId/role-presets')
  @ApiBearerAuth()
  @ApiOkResponse({ type: RolePresetsListDto })
  listRolePresets(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
  ) {
    return this.platform.listPresets(
      authorization,
      requireUuidParam(tenantId, 'tenantId'),
    );
  }

  @Post('tenants/:tenantId/role-presets')
  @ApiBearerAuth()
  @ApiBody({ type: CreateRolePresetBodyDto })
  @ApiCreatedResponse({ type: RolePresetDtoSchema })
  createRolePreset(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Body() body: CreateRolePresetBodyDto,
  ) {
    return this.platform.createPreset(
      authorization,
      requireUuidParam(tenantId, 'tenantId'),
      body,
    );
  }

  @Get('tenants/:tenantId/role-presets/:presetId')
  @ApiBearerAuth()
  @ApiOkResponse({ type: RolePresetDtoSchema })
  getRolePreset(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('presetId') presetId: string,
  ) {
    return this.platform.getPreset(
      authorization,
      requireUuidParam(tenantId, 'tenantId'),
      requireUuidParam(presetId, 'presetId'),
    );
  }

  @Post('me/membership-invites/accept')
  @ApiBearerAuth()
  accept(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { token: string },
  ) {
    return this.platform.acceptInvite(authorization, body);
  }

  @Patch('tenants/:tenantId/members/:membershipId/role')
  @ApiBearerAuth()
  @ApiBody({ type: PortalMemberRoleBodyDto })
  @ApiOkResponse({ type: PortalMembershipMutationResponseDto })
  changeRole(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: PortalMemberRoleBodyDto,
  ) {
    return this.platform.changeRole(
      authorization,
      requireUuidParam(tenantId, 'tenantId'),
      requireUuidParam(membershipId, 'membershipId'),
      body,
    );
  }

  @Put('tenants/:tenantId/members/:membershipId/event-assignments/:eventId')
  @ApiBearerAuth()
  @ApiBody({ type: PortalAssignmentBodyDto })
  @ApiOkResponse({ type: PortalMembershipMutationResponseDto })
  putAssignment(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('membershipId') membershipId: string,
    @Param('eventId') eventId: string,
    @Body() body: PortalAssignmentBodyDto,
  ) {
    return this.platform.putAssignment(
      authorization,
      requireUuidParam(tenantId, 'tenantId'),
      requireUuidParam(membershipId, 'membershipId'),
      requireUuidParam(eventId, 'eventId'),
      body,
    );
  }

  @Delete('tenants/:tenantId/members/:membershipId/event-assignments/:eventId')
  @ApiBearerAuth()
  @ApiBody({ type: PortalReasonBodyDto })
  @ApiOkResponse({ type: PortalMembershipMutationResponseDto })
  deleteAssignment(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('membershipId') membershipId: string,
    @Param('eventId') eventId: string,
    @Body() body: PortalReasonBodyDto,
  ) {
    return this.platform.deleteAssignment(
      authorization,
      requireUuidParam(tenantId, 'tenantId'),
      requireUuidParam(membershipId, 'membershipId'),
      requireUuidParam(eventId, 'eventId'),
      body,
    );
  }

  @Post('tenants/:tenantId/members/:membershipId/revoke')
  @ApiBearerAuth()
  @ApiBody({ type: PortalReasonBodyDto })
  revokeMember(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: PortalReasonBodyDto,
  ) {
    return this.platform.revokeMember(
      authorization,
      requireUuidParam(tenantId, 'tenantId'),
      requireUuidParam(membershipId, 'membershipId'),
      body,
    );
  }

  @Post('tenants/:tenantId/invites/:inviteId/revoke')
  @ApiBearerAuth()
  @ApiBody({ type: PortalReasonBodyDto })
  @ApiOkResponse({ type: PortalInviteRevokeResponseDto })
  revokeInvite(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('inviteId') inviteId: string,
    @Body() body: PortalReasonBodyDto,
  ) {
    return this.platform.revokeInvite(
      authorization,
      requireUuidParam(tenantId, 'tenantId'),
      requireUuidParam(inviteId, 'inviteId'),
      body,
    );
  }

  @Post('tenants/:tenantId/invites/:inviteId/resend')
  @ApiBearerAuth()
  @ApiBody({ type: PortalReasonBodyDto })
  @ApiOkResponse({ type: PortalInviteResendResponseDto })
  resendInvite(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('inviteId') inviteId: string,
    @Body() body: PortalReasonBodyDto,
  ) {
    return this.platform.resendInvite(
      authorization,
      requireUuidParam(tenantId, 'tenantId'),
      requireUuidParam(inviteId, 'inviteId'),
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

  @Post('me/account-deletion-requests')
  @ApiBearerAuth()
  requestDeletion(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { confirmation: true },
  ) {
    return this.platform.requestDeletion(authorization, body);
  }

  @Get('me/account-deletion-requests/current')
  @ApiBearerAuth()
  currentDeletion(@Headers('authorization') authorization: string | undefined) {
    return this.platform.currentDeletion(authorization);
  }
}
