import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import {
  Controller,
  Get,
  Headers,
  HttpException,
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
  ApiBearerAuth,
  ApiOkResponse,
  ApiProperty,
  ApiUnauthorizedResponse,
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import {
  API_VERSION,
  IDENTITY_ERROR_CODES,
  type ApiError,
  type HealthResponse,
  type MeResponse,
} from '@ticket/contracts';
import {
  createDatabase,
  createOidcVerifier,
  createPrismaIdentityUserRepository,
  IdentityError,
  readOidcEnvironment,
  readProcessEnvironment,
  type CodeHmacConfig,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';
import { ConfigPublishController, ConfigPublishService } from './config';
import { InventoryController, InventoryService } from './inventory';
import { ApprovalController, ApprovalService } from './approval';
import { ReportController, ReportService } from './reporting';
import { GateController, GateService } from './gate';
import { EventAdminController, EventAdminService } from './events';
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

class HealthDto implements HealthResponse {
  @ApiProperty({ enum: ['ok'] }) status!: 'ok';
  @ApiProperty({ enum: ['api'] }) service!: 'api';
  @ApiProperty({ example: '0.1.0' }) version!: string;
}

class MeDto implements MeResponse {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() issuer!: string;
  @ApiProperty() subject!: string;
  @ApiProperty({ nullable: true, type: String }) email!: string | null;
  @ApiProperty() emailVerified!: boolean;
}

class ApiErrorDto implements ApiError {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiProperty() requestId!: string;
  @ApiProperty({ required: false }) operationId?: string;
  @ApiProperty() retryable!: boolean;
}

function toHttpException(error: IdentityError): HttpException {
  const requestId = randomUUID();
  const body: ApiError = {
    code: error.code,
    message: error.message,
    requestId,
    retryable: error.retryable,
  };
  const status =
    error.code === IDENTITY_ERROR_CODES.UNAUTHENTICATED
      ? 401
      : error.code === IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED
        ? 503
        : error.code === IDENTITY_ERROR_CODES.EMAIL_NOT_VERIFIED
          ? 403
          : 401;
  return new HttpException(body, status);
}

@Injectable()
class IdentityService {
  constructor(
    private readonly verifier: OidcVerifier | null,
    private readonly users: IdentityUserRepository | null,
    private readonly bootError: IdentityError | null,
  ) {}

  async me(authorization: string | undefined): Promise<MeResponse> {
    if (this.bootError) throw this.bootError;
    if (!this.verifier || !this.users) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Identity services are not configured',
      );
    }
    const verified = await this.verifier.verifyBearerToken(authorization);
    const user = await this.users.upsertFromVerifiedIdentity(verified);
    return {
      userId: user.userId,
      issuer: user.issuer,
      subject: user.subject,
      email: user.email,
      emailVerified: user.emailVerified,
    };
  }
}

@Controller('health')
class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthDto })
  health(): HealthResponse {
    return { status: 'ok', service: 'api', version: '0.1.0' };
  }
}

@Controller('me')
class MeController {
  constructor(private readonly identity: IdentityService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOkResponse({ type: MeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  async me(
    @Headers('authorization') authorization?: string,
  ): Promise<MeResponse> {
    try {
      return await this.identity.me(authorization);
    } catch (error) {
      if (error instanceof IdentityError) throw toHttpException(error);
      throw error;
    }
  }
}

export type CreateAppOptions = {
  logging?: boolean;
  /**
   * When true, wire OIDC + Prisma users from `env` (default process.env).
   * Tests should inject verifier/users or leave this unset (fail closed).
   */
  fromEnv?: boolean;
  /** Override process.env when fromEnv is true. */
  env?: NodeJS.ProcessEnv;
  oidcVerifier?: OidcVerifier;
  users?: IdentityUserRepository;
  /** When set, identity stack is intentionally unavailable (fail closed). */
  identityBootError?: IdentityError;
  /** Owned Prisma client closed on app destroy when created from env. */
  databaseUrl?: string;
  /** Inject DB for redeem/tickets (tests). */
  database?: PrismaClient;
  hmac?: CodeHmacConfig;
  credentialKey?: string;
};

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

function resolveIdentity(options: CreateAppOptions): {
  verifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  bootError: IdentityError | null;
  db: PrismaClient | null;
  ownsDb: boolean;
  hmac: CodeHmacConfig | null;
  credentialKey: string | null;
} {
  if (options.identityBootError) {
    return {
      verifier: null,
      users: null,
      bootError: options.identityBootError,
      db: null,
      ownsDb: false,
      hmac: null,
      credentialKey: null,
    };
  }
  if (options.oidcVerifier && options.users) {
    const env = options.env ?? process.env;
    const issue = resolveIssueDeps(env);
    return {
      verifier: options.oidcVerifier,
      users: options.users,
      bootError: null,
      db: options.database ?? null,
      ownsDb: false,
      hmac: options.hmac ?? issue.hmac,
      credentialKey: options.credentialKey ?? issue.credentialKey,
    };
  }

  if (
    !options.fromEnv &&
    !options.env &&
    !options.databaseUrl &&
    !options.database
  ) {
    return {
      verifier: null,
      users: null,
      bootError: new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Identity services are not configured',
      ),
      db: null,
      ownsDb: false,
      hmac: null,
      credentialKey: null,
    };
  }

  const env = options.env ?? process.env;
  let verifier: OidcVerifier | null = options.oidcVerifier ?? null;
  let bootError: IdentityError | null = null;
  if (!verifier) {
    try {
      verifier = createOidcVerifier(readOidcEnvironment(env));
    } catch (error) {
      if (error instanceof IdentityError) bootError = error;
      else throw error;
    }
  }

  let db: PrismaClient | null = options.database ?? null;
  let ownsDb = false;
  let users: IdentityUserRepository | null = options.users ?? null;
  if (!users) {
    const databaseUrl = options.databaseUrl ?? env['DATABASE_URL'];
    if (!databaseUrl?.trim() && !db) {
      bootError =
        bootError ??
        new IdentityError(
          IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
          'DATABASE_URL is required for identity persistence',
        );
    } else if (!db && databaseUrl) {
      db = createDatabase(databaseUrl);
      ownsDb = true;
      users = createPrismaIdentityUserRepository(db);
    } else if (db) {
      users = createPrismaIdentityUserRepository(db);
    }
  }

  const issue = resolveIssueDeps(env);
  return {
    verifier,
    users,
    bootError,
    db,
    ownsDb,
    hmac: options.hmac ?? issue.hmac,
    credentialKey: options.credentialKey ?? issue.credentialKey,
  };
}

export async function createApp(
  options: CreateAppOptions | boolean = {},
): Promise<NestFastifyApplication> {
  // Backward compatible: createApp(false) disables logging (existing tests).
  const normalized: CreateAppOptions =
    typeof options === 'boolean' ? { logging: options } : options;
  const logging = normalized.logging ?? true;
  const identity = resolveIdentity(normalized);

  const ticketDeps: TicketServices = {
    db: identity.db,
    verifier: identity.verifier,
    users: identity.users,
    bootError: identity.bootError,
    hmac: identity.hmac,
    credentialKey: identity.credentialKey,
  };

  @Module({
    controllers: [
      HealthController,
      MeController,
      EventAdminController,
      TicketIssueController,
      GateController,
      ConfigPublishController,
      InventoryController,
      ApprovalController,
      ReportController,
      NotificationController,
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
        useValue: new TicketIssueService(ticketDeps),
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
        useValue: new InventoryService(ticketDeps),
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
        provide: NotificationService,
        useValue: new NotificationService(ticketDeps),
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
      bodyLimit: 1048576,
      trustProxy: false,
    }),
    { logger: logging ? undefined : false },
  );
  app.setGlobalPrefix(API_VERSION);
  app.enableShutdownHooks();
  return app;
}

export function createOpenApi(app: NestFastifyApplication) {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Ticket API — D2 issue')
      .setVersion('0.2.0')
      .setDescription(
        'Identity, redemption issue, manual approval, and read-only event reports. PostgreSQL quota is the source of truth; Redis is not.',
      )
      .addBearerAuth()
      .build(),
  );
}
