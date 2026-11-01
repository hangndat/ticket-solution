import type { PortalReasonBody } from '@ticket/contracts';
import { PLATFORM_ERROR_CODES } from '@ticket/contracts';
import {
  PlatformError,
  createSupportGrant,
  getPlatformMe,
  getPlatformTenantDetail,
  getPlatformTenantHealth,
  listPlatformAudit,
  listPlatformTenants,
  listSupportTickets,
  provisionTenant,
  revokeSupportGrant as revokePlatformSupportGrant,
  setTenantStatus,
  updateTenantLimits,
} from '@ticket/backend';
import type { PlatformActors } from './platform-actors';
import type { PlatformDeps } from './platform-deps';
import { platformRouteFail } from './platform-errors';

function isSupportGrantEventReferenceError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const databaseError = error as {
    code?: unknown;
    meta?: { code?: unknown; message?: unknown };
  };
  return (
    databaseError.code === 'P2010' &&
    databaseError.meta?.code === '23503' &&
    typeof databaseError.meta.message === 'string' &&
    databaseError.meta.message.includes('support_grants_event_fk')
  );
}

export class PlatformOperatorService {
  constructor(
    private readonly deps: PlatformDeps,
    private readonly actors: PlatformActors,
  ) {}

  me(authorization: string | undefined) {
    return this.actors
      .platformActor(authorization)
      .then((u) => getPlatformMe(this.deps.db!, u.userId))
      .then((r) => ({ ...r, assurance: 'mfa' as const }))
      .catch(platformRouteFail);
  }

  createTenant(
    authorization: string | undefined,
    idempotencyKey: string | undefined,
    body: Record<string, unknown>,
  ) {
    return this.actors
      .platformActor(authorization)
      .then((u) =>
        provisionTenant(this.deps.db!, this.deps.security!, {
          actorUserId: u.userId,
          clientKey: idempotencyKey ?? '',
          body: body as never,
        }),
      )
      .then((r) => ({
        tenantId: r.tenantId,
        status: r.status,
        version: r.version,
        ownerInviteId: r.ownerInviteId,
      }))
      .catch(platformRouteFail);
  }

  tenantDetail(authorization: string | undefined, tenantId: string) {
    return this.actors
      .platformActor(authorization)
      .then((u) => getPlatformTenantDetail(this.deps.db!, u.userId, tenantId))
      .catch(platformRouteFail);
  }

  tenantHealth(authorization: string | undefined, tenantId: string) {
    return this.actors
      .platformActor(authorization)
      .then((u) => getPlatformTenantHealth(this.deps.db!, u.userId, tenantId))
      .catch(platformRouteFail);
  }

  listTenants(
    authorization: string | undefined,
    query: { cursor?: string; limit?: number },
  ) {
    return this.actors
      .platformActor(authorization)
      .then((u) =>
        listPlatformTenants(this.deps.db!, {
          actorUserId: u.userId,
          cursor: query.cursor,
          limit: query.limit,
        }),
      )
      .catch(platformRouteFail);
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
    return this.actors
      .platformActor(authorization)
      .then((u) =>
        listPlatformAudit(this.deps.db!, {
          actorUserId: u.userId,
          cursor: query.cursor,
          limit: query.limit,
          from: query.from,
          to: query.to,
          action: query.action,
          tenantId: query.tenantId,
        }),
      )
      .catch(platformRouteFail);
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
    return this.actors
      .platformActor(authorization)
      .then((u) =>
        setTenantStatus(this.deps.db!, {
          actorUserId: u.userId,
          tenantId,
          status: body.status,
          reason: body.reason,
          expectedVersion: body.expectedVersion,
        }),
      )
      .catch(platformRouteFail);
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
    return this.actors
      .platformActor(authorization)
      .then((u) =>
        updateTenantLimits(this.deps.db!, {
          actorUserId: u.userId,
          tenantId,
          limits: body.limits,
          flags: body.flags,
          reason: body.reason,
          expectedVersion: body.expectedVersion,
        }),
      )
      .catch(platformRouteFail);
  }

  supportGrant(authorization: string | undefined, body: never) {
    return this.actors
      .platformActor(authorization)
      .then((u) =>
        createSupportGrant(this.deps.db!, this.deps.security!, {
          actorUserId: u.userId,
          ...(body as object as {
            tenantId: string;
            eventId: string;
            scopes: string[];
            reason: string;
            expiresAt: string;
          }),
        }).catch((error: unknown) => {
          if (isSupportGrantEventReferenceError(error)) {
            throw new PlatformError(
              PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
              'Resource not found',
            );
          }
          throw error;
        }),
      )
      .catch(platformRouteFail);
  }

  revokeSupportGrant(
    authorization: string | undefined,
    grantId: string,
    body: PortalReasonBody,
  ) {
    return this.actors
      .platformActor(authorization)
      .then((u) =>
        revokePlatformSupportGrant(this.deps.db!, {
          actorUserId: u.userId,
          grantId,
          reason: body.reason,
        }),
      )
      .catch(platformRouteFail);
  }

  supportTickets(
    authorization: string | undefined,
    tenantId: string,
    grantId: string,
  ) {
    return this.actors
      .platformActor(authorization)
      .then((u) =>
        listSupportTickets(this.deps.db!, {
          actorUserId: u.userId,
          grantId,
        }),
      )
      .then((items) => ({ items }))
      .catch(platformRouteFail);
  }
}
