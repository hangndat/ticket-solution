import {
  type CreateInviteBody,
  type CreateRolePresetBody,
  type PortalInviteState,
  PLATFORM_ERROR_CODES,
} from '@ticket/contracts';
import {
  PlatformError,
  changePortalMemberRole,
  createMembershipInvite,
  createRolePreset,
  deletePortalEventAssignment,
  getRolePreset,
  isMembershipRole,
  listPortalInvites,
  listPortalMembers,
  listRolePresets,
  parseInviteRole,
  putPortalEventAssignment,
  resendPortalInvite,
  revokeMembershipKeepingLastOwner,
  revokePortalInvite,
} from '@ticket/backend';
import type { PlatformActors } from './platform-actors';
import type { PlatformDeps } from './platform-deps';
import { platformRouteFail } from './platform-errors';

export class PlatformMembershipService {
  constructor(
    private readonly deps: PlatformDeps,
    private readonly actors: PlatformActors,
  ) {}

  invite(
    authorization: string | undefined,
    tenantId: string,
    idempotencyKey: string | undefined,
    body: CreateInviteBody & Record<string, unknown>,
  ) {
    const role = parseInviteRole(body.role);
    if (!role) {
      return Promise.reject(
        new PlatformError(PLATFORM_ERROR_CODES.INVALID_INPUT, 'Invalid role'),
      ).catch(platformRouteFail);
    }
    const forged =
      body.permissions ?? body.tenantPermissions ?? body.eventPermissions;
    return this.actors
      .selfActor(authorization)
      .then((u) =>
        createMembershipInvite(this.deps.db!, this.deps.security!, {
          tenantId,
          actorUserId: u.userId,
          email: body.email,
          role,
          eventAssignments: body.eventAssignments,
          clientKey: idempotencyKey ?? '',
          forgedPermissions: forged,
        }),
      )
      .then((r) => ({
        inviteId: r.inviteId,
        state: r.state,
        expiresAt: r.expiresAt,
        deliveryState: r.deliveryState,
      }))
      .catch(platformRouteFail);
  }

  createPreset(
    authorization: string | undefined,
    tenantId: string,
    body: CreateRolePresetBody,
  ) {
    return this.actors
      .selfActor(authorization)
      .then((u) =>
        createRolePreset(this.deps.db!, {
          tenantId,
          actorUserId: u.userId,
          name: body.name,
          tenantPermissions: body.tenantPermissions,
          eventPermissions: body.eventPermissions,
        }),
      )
      .catch(platformRouteFail);
  }

  listPresets(authorization: string | undefined, tenantId: string) {
    return this.actors
      .selfActor(authorization)
      .then((u) =>
        listRolePresets(this.deps.db!, {
          tenantId,
          actorUserId: u.userId,
        }),
      )
      .then((items) => ({ items }))
      .catch(platformRouteFail);
  }

  getPreset(
    authorization: string | undefined,
    tenantId: string,
    presetId: string,
  ) {
    return this.actors
      .selfActor(authorization)
      .then((u) =>
        getRolePreset(this.deps.db!, {
          tenantId,
          actorUserId: u.userId,
          presetId,
        }),
      )
      .catch(platformRouteFail);
  }

  revokeMember(
    authorization: string | undefined,
    tenantId: string,
    membershipId: string,
    body: { reason: string },
  ) {
    return this.actors
      .selfActor(authorization)
      .then((u) =>
        revokeMembershipKeepingLastOwner(this.deps.db!, {
          tenantId,
          actorUserId: u.userId,
          membershipId,
          reason: body.reason,
        }),
      )
      .catch(platformRouteFail);
  }

  listMembers(
    authorization: string | undefined,
    tenantId: string,
    query: { cursor?: string; limit?: number; includeRevoked?: string },
  ) {
    return this.actors
      .selfActor(authorization)
      .then((u) =>
        listPortalMembers(this.deps.db!, {
          tenantId,
          actorUserId: u.userId,
          cursor: query.cursor,
          limit: query.limit,
          includeRevoked:
            query.includeRevoked === '1' || query.includeRevoked === 'true',
        }),
      )
      .catch(platformRouteFail);
  }

  listInvites(
    authorization: string | undefined,
    tenantId: string,
    query: { cursor?: string; limit?: number; state?: string },
  ) {
    const state = query.state as PortalInviteState | undefined;
    return this.actors
      .selfActor(authorization)
      .then((u) =>
        listPortalInvites(this.deps.db!, {
          tenantId,
          actorUserId: u.userId,
          cursor: query.cursor,
          limit: query.limit,
          state,
        }),
      )
      .catch(platformRouteFail);
  }

  changeRole(
    authorization: string | undefined,
    tenantId: string,
    membershipId: string,
    body: { role: string; reason: string },
  ) {
    if (!isMembershipRole(body.role)) {
      return Promise.reject(
        new PlatformError(PLATFORM_ERROR_CODES.INVALID_INPUT, 'Invalid role'),
      ).catch(platformRouteFail);
    }
    const role = body.role;
    return this.actors
      .selfActor(authorization)
      .then((u) =>
        changePortalMemberRole(this.deps.db!, {
          tenantId,
          actorUserId: u.userId,
          membershipId,
          role,
          reason: body.reason,
        }),
      )
      .catch(platformRouteFail);
  }

  putAssignment(
    authorization: string | undefined,
    tenantId: string,
    membershipId: string,
    eventId: string,
    body: { role: string; reason: string },
  ) {
    if (!isMembershipRole(body.role)) {
      return Promise.reject(
        new PlatformError(PLATFORM_ERROR_CODES.INVALID_INPUT, 'Invalid role'),
      ).catch(platformRouteFail);
    }
    const role = body.role;
    return this.actors
      .selfActor(authorization)
      .then((u) =>
        putPortalEventAssignment(this.deps.db!, {
          tenantId,
          actorUserId: u.userId,
          membershipId,
          eventId,
          role,
          reason: body.reason,
        }),
      )
      .catch(platformRouteFail);
  }

  deleteAssignment(
    authorization: string | undefined,
    tenantId: string,
    membershipId: string,
    eventId: string,
    body: { reason: string },
  ) {
    return this.actors
      .selfActor(authorization)
      .then((u) =>
        deletePortalEventAssignment(this.deps.db!, {
          tenantId,
          actorUserId: u.userId,
          membershipId,
          eventId,
          reason: body.reason,
        }),
      )
      .catch(platformRouteFail);
  }

  revokeInvite(
    authorization: string | undefined,
    tenantId: string,
    inviteId: string,
    body: { reason: string },
  ) {
    return this.actors
      .selfActor(authorization)
      .then((u) =>
        revokePortalInvite(this.deps.db!, {
          tenantId,
          actorUserId: u.userId,
          inviteId,
          reason: body.reason,
        }),
      )
      .catch(platformRouteFail);
  }

  resendInvite(
    authorization: string | undefined,
    tenantId: string,
    inviteId: string,
    body: { reason: string },
  ) {
    return this.actors
      .selfActor(authorization)
      .then((u) =>
        resendPortalInvite(this.deps.db!, this.deps.security!, {
          tenantId,
          actorUserId: u.userId,
          inviteId,
          reason: body.reason,
        }),
      )
      .catch(platformRouteFail);
  }
}
