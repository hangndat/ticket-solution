import 'reflect-metadata';
import {
  Injectable,
  Module,
  type OnModuleDestroy,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import { API_VERSION } from '@ticket/contracts';
import {
  readProcessEnvironment,
  type PrismaClient,
} from '@ticket/backend';
import { ConfigPublishController, ConfigPublishService } from './config';
import { InventoryController, InventoryService } from './inventory';
import { ApprovalController, ApprovalService } from './approval';
import { ReportController, ReportService } from './reporting';
import { GateController, GateService } from './gate';
import { CsController, CsService } from './cs';
import { ExportController, ExportApiService } from './exports';
import { EventAdminController, EventAdminService } from './events';
import { DeviceTokenController, DeviceTokenService } from './device-tokens';
import {
  NotificationController,
  NotificationService,
} from './notifications';
import {
  TicketIssueController,
  TicketIssueService,
  resolveIssueDeps,
  type TicketServices,
} from './tickets';
import {
  RedemptionResolveController,
  RedemptionResolveService,
  buildResolveDeps,
} from './redemptions-resolve';
import { registerMetricsEndpoint } from './metrics';
import {
  PlatformMeController,
  PlatformMembershipController,
  PlatformOperatorController,
  PlatformService,
  buildPlatformDeps,
} from './platform';
import { BrandingController, BrandingService } from './branding';
import {
  PlatformPublishedEventsController,
  PublishedEventsController,
  PublishedEventsService,
} from './published-events';
import {
  TenantRegistrationController,
  TenantRegistrationService,
  buildTenantRegistrationDeps,
} from './tenant-registrations';
import {
  HealthController,
  IdentityService,
  MeController,
  resolveIdentity,
} from './identity';
import type { CreateAppOptions } from './app-options';
import {
  DEFAULT_JSON_BODY_LIMIT_BYTES,
  IMPORT_UPLOAD_BODY_LIMIT_BYTES,
} from './http-limits';
import {
  platformAwareOperationIdFactory,
  reorderOpenApiPaths,
  reorderOpenApiSchemas,
} from './openapi-document';

export type { CreateAppOptions } from './app-options';

@Injectable()
class DatabaseShutdown implements OnModuleDestroy {
  constructor(private readonly db: PrismaClient | null) {}
  async onModuleDestroy() {
    if (this.db) await this.db.$disconnect();
  }
}

export function readApiEnvironment(env: NodeJS.ProcessEnv) {
  const common = readProcessEnvironment(env);
  const port = env['PORT'] ?? '3001';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
    throw new Error('PORT must be 1–65535');
  const host = env['HOST'] ?? '127.0.0.1';
  if (!host || /[\s/]/.test(host)) throw new Error('Invalid HOST');
  return { ...common, port: Number(port), host };
}

export async function createApp(
  options: CreateAppOptions | boolean = {},
): Promise<NestFastifyApplication> {
  // Backward compatible: createApp(false) disables logging (existing tests).
  const normalized: CreateAppOptions =
    typeof options === 'boolean' ? { logging: options } : options;
  const logging = normalized.logging ?? true;
  const identity = resolveIdentity(normalized);
  const env = normalized.env ?? process.env;

  const issueDeps = resolveIssueDeps(env);
  const ticketDeps: TicketServices = {
    db: identity.db,
    verifier: identity.verifier,
    users: identity.users,
    bootError: identity.bootError,
    hmac: identity.hmac ?? issueDeps.hmac,
    credentialKey: identity.credentialKey ?? issueDeps.credentialKey,
    routingPeppers: issueDeps.routingPeppers,
    resolveTokenSecret: issueDeps.resolveTokenSecret,
  };
  const ticketIssueDeps: TicketServices = {
    ...ticketDeps,
    bootError: identity.bootError ?? issueDeps.issueBootError,
  };
  const resolveDeps = buildResolveDeps(env, ticketIssueDeps);

  @Module({
    controllers: [
      HealthController,
      MeController,
      EventAdminController,
      TicketIssueController,
      RedemptionResolveController,
      GateController,
      ConfigPublishController,
      InventoryController,
      ApprovalController,
      ReportController,
      CsController,
      ExportController,
      DeviceTokenController,
      NotificationController,
      PlatformMeController,
      PlatformOperatorController,
      PlatformMembershipController,
      BrandingController,
      PlatformPublishedEventsController,
      PublishedEventsController,
      TenantRegistrationController,
    ],
    providers: [
      {
        provide: IdentityService,
        useValue: new IdentityService(
          identity.verifier,
          identity.users,
          identity.bootError,
        ),
      },
      {
        provide: EventAdminService,
        useValue: new EventAdminService(ticketDeps),
      },
      {
        provide: TicketIssueService,
        useValue: new TicketIssueService(ticketIssueDeps),
      },
      {
        provide: RedemptionResolveService,
        useValue: new RedemptionResolveService(resolveDeps),
      },
      {
        provide: GateService,
        useValue: new GateService(ticketDeps),
      },
      {
        provide: ConfigPublishService,
        useValue: new ConfigPublishService(ticketDeps),
      },
      {
        provide: InventoryService,
        useValue: new InventoryService({ ...ticketDeps, env }),
      },
      {
        provide: ApprovalService,
        useValue: new ApprovalService(ticketDeps),
      },
      {
        provide: ReportService,
        useValue: new ReportService(ticketDeps),
      },
      {
        provide: CsService,
        useValue: new CsService(ticketDeps),
      },
      {
        provide: ExportApiService,
        useValue: new ExportApiService({ ...ticketDeps, env }),
      },
      {
        provide: DeviceTokenService,
        useValue: new DeviceTokenService(ticketDeps),
      },
      {
        provide: NotificationService,
        useValue: new NotificationService(ticketDeps),
      },
      {
        provide: PlatformService,
        useValue: new PlatformService(
          buildPlatformDeps(env, identity.db),
        ),
      },
      {
        provide: BrandingService,
        useValue: new BrandingService(ticketDeps),
      },
      {
        provide: PublishedEventsService,
        useValue: new PublishedEventsService({ db: identity.db }),
      },
      {
        provide: TenantRegistrationService,
        useValue: new TenantRegistrationService(
          buildTenantRegistrationDeps({
            env,
            db: identity.db,
            verifier: identity.verifier,
            users: identity.users,
            bootError: identity.bootError,
          }),
        ),
      },
      {
        provide: DatabaseShutdown,
        useValue: new DatabaseShutdown(identity.ownsDb ? identity.db : null),
      },
    ],
  })
  class AppModule {}

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: DEFAULT_JSON_BODY_LIMIT_BYTES,
      trustProxy: false,
    }),
    { logger: logging ? undefined : false },
  );
  app.getHttpAdapter().getInstance().addHook('onRoute', (routeOptions) => {
    const url = routeOptions.url ?? '';
    if (url.includes('/imports/files')) {
      routeOptions.bodyLimit = IMPORT_UPLOAD_BODY_LIMIT_BYTES;
    }
  });
  // Multipart for H-I1 CSV quarantine upload (Nest Fastify).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  await app.register(require('@fastify/multipart'), {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });
  app.setGlobalPrefix(API_VERSION);
  app.enableShutdownHooks();
  registerMetricsEndpoint(app, { env, db: identity.db });
  return app;
}

export type CreateOpenApiOptions = {
  /** Path keys from the committed spec — keeps `openapi.json` byte-stable across controller splits. */
  pathOrder?: readonly string[];
  /** Schema keys from the committed spec — stable `components.schemas` ordering. */
  schemaOrder?: readonly string[];
};

export function createOpenApi(
  app: NestFastifyApplication,
  options: CreateOpenApiOptions = {},
) {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Ticket API — D4 CS/export/events')
      .setVersion('0.4.0')
      .setDescription(
        'Identity, redemption, gate, CS lookup/resend, CSV export (MinIO), event admin, device tokens. Notification providerStatus ACCEPTED ≠ delivered. PostgreSQL is source of truth.',
      )
      .addBearerAuth()
      .build(),
    { operationIdFactory: platformAwareOperationIdFactory },
  );
  let stable = document;
  if (options.pathOrder?.length) {
    stable = reorderOpenApiPaths(stable, options.pathOrder);
  }
  if (options.schemaOrder?.length) {
    stable = reorderOpenApiSchemas(stable, options.schemaOrder);
  }
  return stable;
}
