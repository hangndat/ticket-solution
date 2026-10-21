import { Injectable } from '@nestjs/common';
import type {
  CreateInviteBody,
  CreateRolePresetBody,
  MeEventsResponse,
  PortalReasonBody,
} from '@ticket/contracts';
import { PlatformActors } from './platform-actors';
import type { PlatformDeps } from './platform-deps';
import { PlatformMembershipService } from './platform-membership.service';
import { PlatformOperatorService } from './platform-operator.service';
import { PlatformSelfService } from './platform-self.service';

@Injectable()
export class PlatformService {
  private readonly operator: PlatformOperatorService;
  private readonly membership: PlatformMembershipService;
  private readonly self: PlatformSelfService;

  constructor(deps: PlatformDeps) {
    const actors = new PlatformActors(deps);
    this.operator = new PlatformOperatorService(deps, actors);
    this.membership = new PlatformMembershipService(deps, actors);
    this.self = new PlatformSelfService(deps, actors);
  }

  me(authorization: string | undefined) {
    return this.operator.me(authorization);
  }

  myTenants(authorization: string | undefined) {
    return this.self.myTenants(authorization);
  }

  myEvents(authorization: string | undefined): Promise<MeEventsResponse> {
    return this.self.myEvents(authorization);
  }

  createTenant(
    authorization: string | undefined,
    idempotencyKey: string | undefined,
    body: Record<string, unknown>,
  ) {
    return this.operator.createTenant(authorization, idempotencyKey, body);
  }

  tenantDetail(authorization: string | undefined, tenantId: string) {
    return this.operator.tenantDetail(authorization, tenantId);
  }

  tenantHealth(authorization: string | undefined, tenantId: string) {
    return this.operator.tenantHealth(authorization, tenantId);
  }

  listTenants(
    authorization: string | undefined,
    query: { cursor?: string; limit?: number },
  ) {
    return this.operator.listTenants(authorization, query);
  }

  listAudit(
    authorization: string | undefined,
    query: {
      cursor?: string;
      limit?: number;
      from?: string;
      to?: string;
      action?: string;
      tenantId?: string;
    },
  ) {
    return this.operator.listAudit(authorization, query);
  }

  setStatus(
    authorization: string | undefined,
    tenantId: string,
    body: {
      status: 'ACTIVE' | 'SUSPENDED';
      reason: string;
      expectedVersion: number;
    },
  ) {
    return this.operator.setStatus(authorization, tenantId, body);
  }

  setLimits(
    authorization: string | undefined,
    tenantId: string,
    body: {
      limits: never;
      flags: never;
      reason: string;
      expectedVersion: number;
    },
  ) {
    return this.operator.setLimits(authorization, tenantId, body);
  }

  invite(
    authorization: string | undefined,
    tenantId: string,
    idempotencyKey: string | undefined,
    body: CreateInviteBody & Record<string, unknown>,
  ) {
    return this.membership.invite(authorization, tenantId, idempotencyKey, body);
  }

  createPreset(
    authorization: string | undefined,
    tenantId: string,
    body: CreateRolePresetBody,
  ) {
    return this.membership.createPreset(authorization, tenantId, body);
  }

  listPresets(authorization: string | undefined, tenantId: string) {
    return this.membership.listPresets(authorization, tenantId);
  }

  getPreset(
    authorization: string | undefined,
    tenantId: string,
    presetId: string,
  ) {
    return this.membership.getPreset(authorization, tenantId, presetId);
  }

  acceptInvite(authorization: string | undefined, body: { token: string }) {
    return this.self.acceptInvite(authorization, body);
  }

  revokeMember(
    authorization: string | undefined,
    tenantId: string,
    membershipId: string,
    body: { reason: string },
  ) {
    return this.membership.revokeMember(authorization, tenantId, membershipId, body);
  }

  listMembers(
    authorization: string | undefined,
    tenantId: string,
    query: { cursor?: string; limit?: number; includeRevoked?: string },
  ) {
    return this.membership.listMembers(authorization, tenantId, query);
  }

  listInvites(
    authorization: string | undefined,
    tenantId: string,
    query: { cursor?: string; limit?: number; state?: string },
  ) {
    return this.membership.listInvites(authorization, tenantId, query);
  }

  changeRole(
    authorization: string | undefined,
    tenantId: string,
    membershipId: string,
    body: { role: string; reason: string },
  ) {
    return this.membership.changeRole(authorization, tenantId, membershipId, body);
  }

  putAssignment(
    authorization: string | undefined,
    tenantId: string,
    membershipId: string,
    eventId: string,
    body: { role: string; reason: string },
  ) {
    return this.membership.putAssignment(
      authorization,
      tenantId,
      membershipId,
      eventId,
      body,
    );
  }

  deleteAssignment(
    authorization: string | undefined,
    tenantId: string,
    membershipId: string,
    eventId: string,
    body: { reason: string },
  ) {
    return this.membership.deleteAssignment(
      authorization,
      tenantId,
      membershipId,
      eventId,
      body,
    );
  }

  revokeInvite(
    authorization: string | undefined,
    tenantId: string,
    inviteId: string,
    body: { reason: string },
  ) {
    return this.membership.revokeInvite(authorization, tenantId, inviteId, body);
  }

  resendInvite(
    authorization: string | undefined,
    tenantId: string,
    inviteId: string,
    body: { reason: string },
  ) {
    return this.membership.resendInvite(authorization, tenantId, inviteId, body);
  }

  supportGrant(authorization: string | undefined, body: never) {
    return this.operator.supportGrant(authorization, body);
  }

  revokeSupportGrant(
    authorization: string | undefined,
    grantId: string,
    body: PortalReasonBody,
  ) {
    return this.operator.revokeSupportGrant(authorization, grantId, body);
  }

  supportTickets(
    authorization: string | undefined,
    tenantId: string,
    grantId: string,
  ) {
    return this.operator.supportTickets(authorization, tenantId, grantId);
  }

  requestDeletion(authorization: string | undefined, body: { confirmation: true }) {
    return this.self.requestDeletion(authorization, body);
  }

  currentDeletion(authorization: string | undefined) {
    return this.self.currentDeletion(authorization);
  }
}
