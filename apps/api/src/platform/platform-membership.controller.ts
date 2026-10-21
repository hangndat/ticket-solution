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
  PortalAssignmentBodyDto,
  PortalInviteRevokeResponseDto,
  PortalInviteResendResponseDto,
  PortalInvitesPageDto,
  PortalMemberRoleBodyDto,
  PortalMembersPageDto,
  PortalMembershipMutationResponseDto,
  PortalReasonBodyDto,
  RolePresetDtoSchema,
  RolePresetsListDto,
} from './platform-dtos';
import { PlatformService } from './platform.service';

@ApiTags('platform')
@ApiExtraModels(InviteRolePresetDto, CreateInviteBodyDto, RolePresetDtoSchema)
@Controller()
export class PlatformMembershipController {
  constructor(private readonly platform: PlatformService) {}

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
}
