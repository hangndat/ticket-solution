import { Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  IdentityError,
  IDENTITY_ERROR_CODES,
  createIssuanceSource,
  createTicketType,
  listIssuanceSources,
  listTicketTypes,
  withTenant,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';

export class CreateTicketTypeBodyDto {
  @ApiProperty() label!: string;
  @ApiProperty({ required: false })
  entitlementSnapshot?: Record<string, unknown>;
}

export class TicketTypeCreatedDto {
  @ApiProperty({ format: 'uuid' }) ticketTypeId!: string;
  @ApiProperty() label!: string;
}

export class CreateSourceBodyDto {
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['AUTO', 'MANUAL'] }) approvalMode!: 'AUTO' | 'MANUAL';
  @ApiProperty({ format: 'uuid' }) ticketTypeId!: string;
}

export class SourceCreatedDto {
  @ApiProperty({ format: 'uuid' }) sourceId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['AUTO', 'MANUAL'] }) approvalMode!: 'AUTO' | 'MANUAL';
  @ApiProperty({ format: 'uuid' }) ticketTypeId!: string;
}

export class PortalTicketTypeSummaryDto {
  @ApiProperty({ format: 'uuid' }) ticketTypeId!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  entitlementSnapshot!: Record<string, unknown>;
}

export class PortalTicketTypesPageDto {
  @ApiProperty({ type: [PortalTicketTypeSummaryDto] })
  items!: PortalTicketTypeSummaryDto[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
}

export class PortalSourceSummaryDto {
  @ApiProperty({ format: 'uuid' }) sourceId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['AUTO', 'MANUAL'] }) approvalMode!: 'AUTO' | 'MANUAL';
  @ApiProperty({ type: [String], format: 'uuid' }) ticketTypeIds!: string[];
}

export class PortalSourcesPageDto {
  @ApiProperty({ type: [PortalSourceSummaryDto] })
  items!: PortalSourceSummaryDto[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
}

type Deps = {
  db: PrismaClient | null;
  verifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  bootError: IdentityError | null;
};

@Injectable()
export class EventCatalogService {
  constructor(private readonly deps: Deps) {}

  private async actor(authorization: string | undefined) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.db || !this.deps.verifier || !this.deps.users) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Event services are not configured',
      );
    }
    const verified = await this.deps.verifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity(verified);
  }

  async ticketType(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: CreateTicketTypeBodyDto,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      createTicketType(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        label: body.label,
        entitlementSnapshot: body.entitlementSnapshot,
      }),
    );
  }

  async listTicketTypes(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    cursor?: string,
    limit?: number,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      listTicketTypes(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        cursor,
        limit,
      }),
    );
  }

  async source(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: CreateSourceBodyDto,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      createIssuanceSource(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        name: body.name,
        approvalMode: body.approvalMode,
        ticketTypeId: body.ticketTypeId,
      }),
    );
  }

  async listSources(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    cursor?: string,
    limit?: number,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      listIssuanceSources(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        cursor,
        limit,
      }),
    );
  }
}
