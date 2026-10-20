import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Injectable,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import {
  NOTIFICATION_ERROR_CODES,
  NOTIFICATION_KINDS,
  type ApiError,
  type NotificationChannel,
  type NotificationKind,
  type NotificationProviderStatus,
} from '@ticket/contracts';
import {
  AuthzError,
  IdentityError,
  IDENTITY_ERROR_CODES,
  NotificationError,
  listEventNotifications,
  previewNotificationTemplate,
  publishNotificationTemplate,
  retryNotificationDelivery,
  withTenant,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';
import { identityErrorHttpStatus } from './identity-http-status';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class TemplateBodyDto {
  @ApiProperty({ enum: NOTIFICATION_KINDS })
  kind!: NotificationKind;
  @ApiProperty() subject!: string;
  @ApiProperty() bodyText!: string;
  @ApiProperty() bodyHtml!: string;
  @ApiProperty({ required: false })
  sampleVariables?: Record<string, string>;
}

class RetryBodyDto {
  @ApiProperty() reason!: string;
}

type Deps = {
  db: PrismaClient | null;
  verifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  bootError: IdentityError | null;
};

function scopeError(message: string): HttpException {
  return new HttpException(
    {
      code: 'SCOPE_REQUIRED',
      message,
      requestId: randomUUID(),
      retryable: false,
    } satisfies ApiError,
    422,
  );
}

function requireUuid(value: string | undefined, name: string): string {
  const trimmed = value?.trim() ?? '';
  if (!UUID.test(trimmed)) throw scopeError(`${name} must be a UUID`);
  return trimmed;
}

@Injectable()
export class NotificationService {
  constructor(private readonly deps: Deps) {}

  private async actor(authorization: string | undefined) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.db || !this.deps.verifier || !this.deps.users) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Notification services are not configured',
      );
    }
    const verified = await this.deps.verifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity(verified);
  }

  async list(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    cursor?: string,
    state?: NotificationProviderStatus,
    channel?: NotificationChannel,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      listEventNotifications(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        cursor: cursor ?? null,
        state,
        channel,
      }),
    );
  }

  async preview(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: TemplateBodyDto,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      previewNotificationTemplate(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        kind: body.kind,
        subject: body.subject,
        bodyText: body.bodyText,
        bodyHtml: body.bodyHtml,
        sampleVariables: body.sampleVariables ?? {},
      }),
    );
  }

  async publish(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    body: TemplateBodyDto,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      publishNotificationTemplate(tx, {
        tenantId,
        eventId,
        actorUserId: user.userId,
        kind: body.kind,
        subject: body.subject,
        bodyText: body.bodyText,
        bodyHtml: body.bodyHtml,
      }),
    );
  }

  async retry(
    authorization: string | undefined,
    tenantId: string,
    eventId: string,
    notificationId: string,
    reason: string,
  ) {
    const user = await this.actor(authorization);
    return withTenant(this.deps.db!, tenantId, (tx) =>
      retryNotificationDelivery(tx, {
        tenantId,
        eventId,
        notificationId,
        actorUserId: user.userId,
        reason,
      }),
    );
  }
}

@ApiTags('notifications')
@Controller()
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  private fail(error: unknown): never {
    if (error instanceof IdentityError) {
      throw new HttpException(
        {
          code: error.code,
          message: error.message,
          requestId: randomUUID(),
          retryable: error.retryable,
        } satisfies ApiError,
        identityErrorHttpStatus(error.code),
      );
    }
    if (error instanceof AuthzError) {
      throw new HttpException(
        {
          code: error.code,
          message: error.message,
          requestId: randomUUID(),
          retryable: false,
        } satisfies ApiError,
        403,
      );
    }
    if (error instanceof NotificationError) {
      const status =
        error.code === NOTIFICATION_ERROR_CODES.NOTIFICATION_NOT_FOUND
          ? 404
          : error.code === NOTIFICATION_ERROR_CODES.RESEND_COOLDOWN ||
              error.code === NOTIFICATION_ERROR_CODES.RESEND_LIMIT ||
              error.code === NOTIFICATION_ERROR_CODES.RATE_LIMITED
            ? 429
            : 422;
      throw new HttpException(
        {
          code: error.code,
          message: error.message,
          requestId: randomUUID(),
          retryable: error.retryable,
        } satisfies ApiError,
        status,
      );
    }
    throw error;
  }

  @Get('tenants/:tenantId/events/:eventId/notifications')
  @ApiBearerAuth()
  list(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Query('cursor') cursor?: string,
    @Query('state') stateRaw?: string,
    @Query('channel') channelRaw?: string,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    const states = new Set([
      'PENDING',
      'ACCEPTED',
      'FAILED',
      'DEAD',
      'UNKNOWN',
    ]);
    const channels = new Set(['email', 'push']);
    let state: NotificationProviderStatus | undefined;
    let channel: NotificationChannel | undefined;
    if (stateRaw != null && stateRaw !== '') {
      if (!states.has(stateRaw)) {
        throw scopeError('state must be a NotificationProviderStatus');
      }
      state = stateRaw as NotificationProviderStatus;
    }
    if (channelRaw != null && channelRaw !== '') {
      if (!channels.has(channelRaw)) {
        throw scopeError('channel must be email or push');
      }
      channel = channelRaw as NotificationChannel;
    }
    if (cursor != null && cursor !== '') {
      requireUuid(cursor, 'cursor');
    }
    return this.notifications
      .list(authorization, tenant, event, cursor, state, channel)
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/notification-templates/preview')
  @ApiBearerAuth()
  preview(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: TemplateBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    if (!body?.kind || !NOTIFICATION_KINDS.includes(body.kind)) {
      throw scopeError('kind must be an allowlisted NotificationKind');
    }
    if (typeof body.subject !== 'string' || typeof body.bodyText !== 'string') {
      throw scopeError('subject and bodyText are required');
    }
    if (typeof body.bodyHtml !== 'string') {
      throw scopeError('bodyHtml is required');
    }
    return this.notifications
      .preview(authorization, tenant, event, body)
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/notification-templates/publish')
  @ApiBearerAuth()
  publish(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() body: TemplateBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    if (!body?.kind || !NOTIFICATION_KINDS.includes(body.kind)) {
      throw scopeError('kind must be an allowlisted NotificationKind');
    }
    return this.notifications
      .publish(authorization, tenant, event, body)
      .catch((error) => this.fail(error));
  }

  @Post('tenants/:tenantId/events/:eventId/notifications/:notificationId/retry')
  @ApiBearerAuth()
  retry(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Param('notificationId') notificationId: string,
    @Body() body: RetryBodyDto,
  ) {
    const tenant = requireUuid(tenantId, 'tenantId');
    const event = requireUuid(eventId, 'eventId');
    const note = requireUuid(notificationId, 'notificationId');
    if (typeof body?.reason !== 'string') {
      throw scopeError('reason is required');
    }
    return this.notifications
      .retry(authorization, tenant, event, note, body.reason)
      .catch((error) => this.fail(error));
  }
}
