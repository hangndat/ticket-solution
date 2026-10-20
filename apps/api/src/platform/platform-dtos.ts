import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import {
  type CreateInviteBody,
  type CreateRolePresetBody,
  type InviteRoleRef,
  type MeEventItem,
  type MeEventsResponse,
  type PortalAssignmentBody,
  type PortalInviteRevokeResponse,
  type PortalInviteState,
  type PortalInviteSummary,
  type PortalInvitesPage,
  type PortalMemberAssignment,
  type PortalMemberRoleBody,
  type PortalMemberSummary,
  type PortalMembersPage,
  type PortalMembershipMutationResponse,
  type PortalPlatformAuditEntry,
  type PortalPlatformAuditPage,
  type PortalPlatformTenantHealth,
  type PortalPlatformTenantSummary,
  type PortalPlatformTenantsPage,
  type PortalReasonBody,
  type RolePresetDto,
  type RolePresetsListResponse,
} from '@ticket/contracts';

export class MeEventItemDto implements MeEventItem {
  @ApiProperty({ format: 'uuid' }) tenantId!: string;
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: [String] }) permissions!: string[];
}

export class MeEventsDto implements MeEventsResponse {
  @ApiProperty({
    description:
      'true iff active tenant membership OR active event assignment',
  })
  staffEligible!: boolean;
  @ApiProperty({ type: [MeEventItemDto] }) items!: MeEventItemDto[];
}

export const MEMBERSHIP_ROLES = [
  'Owner',
  'Manager',
  'CS',
  'Supervisor',
  'Scanner',
] as const;

export class PortalMemberAssignmentDto implements PortalMemberAssignment {
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ type: [String] }) permissions!: string[];
  @ApiProperty({ nullable: true, type: String }) activatedAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) revokedAt!: string | null;
}

export class PortalMemberSummaryDto implements PortalMemberSummary {
  @ApiProperty({ format: 'uuid' }) membershipId!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ nullable: true, type: String }) emailMasked!: string | null;
  @ApiProperty({
    description: 'Built-in MembershipRole or role_presets.id',
  })
  role!: string;
  @ApiProperty({ nullable: true, type: String }) activatedAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) revokedAt!: string | null;
  @ApiProperty({ type: [PortalMemberAssignmentDto] })
  eventAssignments!: PortalMemberAssignmentDto[];
}

export class PortalMembersPageDto implements PortalMembersPage {
  @ApiProperty({ type: [PortalMemberSummaryDto] })
  items!: PortalMemberSummaryDto[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
}

export class PortalInviteSummaryDto implements PortalInviteSummary {
  @ApiProperty({ format: 'uuid' }) inviteId!: string;
  @ApiProperty() emailMasked!: string;
  @ApiProperty({
    description: 'Built-in MembershipRole or role_presets.id',
  })
  role!: string;
  @ApiProperty({ enum: ['PENDING', 'USED', 'REVOKED', 'EXPIRED'] })
  state!: PortalInviteState;
  @ApiProperty() expiresAt!: string;
  @ApiProperty({
    enum: ['PENDING', 'ACCEPTED', 'FAILED', 'UNKNOWN'],
    description:
      'ACCEPTED = outbox processing completed; never proof of inbox delivery',
  })
  deliveryState!: PortalInviteSummary['deliveryState'];
}

export class InviteRolePresetDto {
  @ApiProperty({ format: 'uuid' }) presetId!: string;
}

export class CreateInviteBodyDto implements CreateInviteBody {
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty({
    oneOf: [
      { type: 'string', enum: [...MEMBERSHIP_ROLES] },
      { $ref: getSchemaPath(InviteRolePresetDto) },
    ],
    description:
      'MembershipRole enum or { presetId } — never client permission arrays',
  })
  role!: InviteRoleRef;
}

export class RolePresetDtoSchema implements RolePresetDto {
  @ApiProperty({ format: 'uuid' }) presetId!: string;
  @ApiProperty({ nullable: true, format: 'uuid', type: String })
  tenantId!: string | null;
  @ApiProperty() name!: string;
  @ApiProperty() schemaVersion!: number;
  @ApiProperty({ type: [String] }) tenantPermissions!: string[];
  @ApiProperty({ type: [String] }) eventPermissions!: string[];
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class RolePresetsListDto implements RolePresetsListResponse {
  @ApiProperty({ type: [RolePresetDtoSchema] }) items!: RolePresetDto[];
}

export class CreateRolePresetBodyDto implements CreateRolePresetBody {
  @ApiProperty() name!: string;
  @ApiProperty({ type: [String], required: false })
  tenantPermissions?: string[];
  @ApiProperty({ type: [String], required: false })
  eventPermissions?: string[];
}

export class PortalInvitesPageDto implements PortalInvitesPage {
  @ApiProperty({ type: [PortalInviteSummaryDto] })
  items!: PortalInviteSummaryDto[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
}

export class PortalMemberRoleBodyDto implements PortalMemberRoleBody {
  @ApiProperty({ enum: MEMBERSHIP_ROLES }) role!: PortalMemberRoleBody['role'];
  @ApiProperty() reason!: string;
}

export class PortalAssignmentBodyDto implements PortalAssignmentBody {
  @ApiProperty({ enum: MEMBERSHIP_ROLES }) role!: PortalAssignmentBody['role'];
  @ApiProperty() reason!: string;
}

export class PortalReasonBodyDto implements PortalReasonBody {
  @ApiProperty() reason!: string;
}

export class PortalMembershipMutationResponseDto
  implements PortalMembershipMutationResponse
{
  @ApiProperty({ format: 'uuid' }) membershipId!: string;
}

export class PortalInviteRevokeResponseDto implements PortalInviteRevokeResponse {
  @ApiProperty({ format: 'uuid' }) inviteId!: string;
  @ApiProperty({ enum: ['REVOKED'] }) state!: 'REVOKED';
}

export class PortalInviteResendResponseDto {
  @ApiProperty({ format: 'uuid' }) inviteId!: string;
  @ApiProperty({ enum: ['PENDING'] }) state!: 'PENDING';
  @ApiProperty() expiresAt!: string;
  @ApiProperty({ enum: ['PENDING'] }) deliveryState!: 'PENDING';
}

export class PortalPlatformTenantSummaryDto implements PortalPlatformTenantSummary {
  @ApiProperty({ format: 'uuid' }) tenantId!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['PENDING', 'ACTIVE', 'SUSPENDED'] })
  status!: PortalPlatformTenantSummary['status'];
  @ApiProperty() version!: number;
  @ApiProperty() createdAt!: string;
}

export class PortalPlatformTenantsPageDto implements PortalPlatformTenantsPage {
  @ApiProperty({ type: [PortalPlatformTenantSummaryDto] })
  items!: PortalPlatformTenantSummaryDto[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
}

export class PortalPlatformAuditEntryDto implements PortalPlatformAuditEntry {
  @ApiProperty({ format: 'uuid' }) auditId!: string;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  actorUserId!: string | null;
  @ApiProperty() action!: string;
  @ApiProperty() resourceType!: string;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  resourceId!: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  tenantId!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class PortalPlatformAuditPageDto implements PortalPlatformAuditPage {
  @ApiProperty({ type: [PortalPlatformAuditEntryDto] })
  items!: PortalPlatformAuditEntryDto[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
}

export class PlatformTenantUsageDto {
  @ApiProperty() events!: number;
  @ApiProperty() staffActive!: number;
  @ApiProperty() staffPendingInvites!: number;
  @ApiProperty() emailToday!: number;
}

export class PlatformHealthNotificationsDto {
  @ApiProperty() pending!: number;
  @ApiProperty() failed!: number;
  @ApiProperty() dead!: number;
}

export class PlatformHealthOutboxDto {
  @ApiProperty() pending!: number;
  @ApiProperty() failed!: number;
}

export class PortalPlatformTenantHealthDto implements PortalPlatformTenantHealth {
  @ApiProperty({ format: 'uuid' }) tenantId!: string;
  @ApiProperty({ format: 'date-time' }) observedAt!: string;
  @ApiProperty({ type: PlatformHealthNotificationsDto })
  notifications!: PlatformHealthNotificationsDto;
  @ApiProperty({ type: PlatformHealthOutboxDto })
  outbox!: PlatformHealthOutboxDto;
  @ApiProperty({ type: PlatformTenantUsageDto })
  usage!: PlatformTenantUsageDto;
}

export class SupportGrantRevokeResponseDto {
  @ApiProperty({ format: 'uuid' }) grantId!: string;
  @ApiProperty({ format: 'date-time' }) revokedAt!: string;
}
