import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Headers,
  HttpException,
  Injectable,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  IDENTITY_ERROR_CODES,
  ISSUE_ERROR_CODES,
  RESOLVE_ERROR_CODES,
  type ApiError,
  type RedemptionResolveRequestBody,
  type RedemptionResolveResponse,
} from '@ticket/contracts';
import {
  IdentityError,
  IssueError,
  buildRedemptionResolveResponse,
  countAmbiguousRoutingGroups,
  createDatabase,
  isSingleCodeResolveGlobalEnabled,
  lookupRoutableTarget,
  readResolveTokenSecret,
  readSupportedPepperConfigs,
  tryConsumeRateLimit,
  withTenant,
  type CodeHmacConfig,
} from '@ticket/backend';
import { issueHttpException, identityHttpException } from './tickets';
import type { TicketServices } from './tickets';

const RESOLVE_PER_USER_10M = 30;
const RESOLVE_BUCKET = 'redemption.resolve';

class ResolveBodyDto implements RedemptionResolveRequestBody {
  @ApiProperty() code!: string;
}

class ResolveResponseDto implements RedemptionResolveResponse {
  @ApiProperty() tenantId!: string;
  @ApiProperty() eventId!: string;
  @ApiProperty() ticketTypeId!: string;
  @ApiProperty() sourceId!: string;
  @ApiProperty() tenantDisplayName!: string;
  @ApiProperty() eventTitle!: string;
  @ApiProperty() ticketTypeLabel!: string;
  @ApiProperty({ enum: ['AUTO', 'MANUAL'] }) approvalMode!: 'AUTO' | 'MANUAL';
  @ApiProperty() redemptionWindow!: RedemptionResolveResponse['redemptionWindow'];
  @ApiProperty() published!: RedemptionResolveResponse['published'];
  @ApiProperty() resolveToken!: string;
  @ApiProperty() resolveExpiresAt!: string;
  @ApiProperty({ enum: ['global'] }) redemptionFlow!: 'global';
}

class ApiErrorDto implements ApiError {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiProperty() requestId!: string;
  @ApiProperty() retryable!: boolean;
}

export type ResolveServices = TicketServices & {
  peppers: CodeHmacConfig[] | null;
  resolveTokenSecret: string | null;
  env: NodeJS.ProcessEnv;
};

function resolveHttpException(error: IssueError): HttpException {
  if (error.code === ISSUE_ERROR_CODES.CODE_INVALID) {
    return issueHttpException(error);
  }
  if (error.code === ISSUE_ERROR_CODES.REDEMPTION_WINDOW_CLOSED) {
    return issueHttpException(error);
  }
  return issueHttpException(error);
}

@Injectable()
export class RedemptionResolveService {
  constructor(private readonly deps: ResolveServices) {}

  private async requireUser(authorization: string | undefined) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.verifier || !this.deps.users) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Identity services are not configured',
      );
    }
    const verified = await this.deps.verifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity(verified);
  }

  async resolveCode(
    authorization: string | undefined,
    body: RedemptionResolveRequestBody,
  ): Promise<RedemptionResolveResponse> {
    if (!isSingleCodeResolveGlobalEnabled(this.deps.env)) {
      throw new IssueError(
        ISSUE_ERROR_CODES.RESOLVE_DISABLED,
        'Global code resolve is not enabled',
      );
    }
    if (!this.deps.db || !this.deps.peppers?.length || !this.deps.resolveTokenSecret) {
      throw new IssueError(
        ISSUE_ERROR_CODES.CODE_HMAC_MISCONFIGURED,
        'Resolve services are not configured',
      );
    }

    const user = await this.requireUser(authorization);

    const allowed = await this.deps.db.$transaction(async (tx) =>
      tryConsumeRateLimit(tx, {
        tenantId: user.userId,
        bucketKey: RESOLVE_BUCKET,
        limit: RESOLVE_PER_USER_10M,
      }),
    );
    if (!allowed) {
      throw new HttpException(
        {
          code: RESOLVE_ERROR_CODES.RATE_LIMITED,
          message: 'Too many resolve attempts; try again later',
          requestId: randomUUID(),
          retryable: true,
        } satisfies ApiError,
        429,
      );
    }

    const ambiguous = await this.deps.db.$transaction((tx) =>
      countAmbiguousRoutingGroups(tx),
    );
    if (ambiguous > 0) {
      throw new IssueError(
        ISSUE_ERROR_CODES.RESOLVE_DISABLED,
        'Global code resolve is not enabled',
      );
    }

    const target = await this.deps.db.$transaction((tx) =>
      lookupRoutableTarget(tx, this.deps.peppers!, body.code),
    );

    return withTenant(this.deps.db, target.tenantId, (tx) =>
      buildRedemptionResolveResponse(tx, {
        actorUserId: user.userId,
        target,
        resolveTokenSecret: this.deps.resolveTokenSecret!,
      }),
    );
  }
}

@ApiTags('redemptions')
@Controller()
export class RedemptionResolveController {
  constructor(private readonly resolveService: RedemptionResolveService) {}

  @Post('redemptions/resolve')
  @ApiBearerAuth()
  @ApiOkResponse({ type: ResolveResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  async resolve(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ResolveBodyDto,
  ): Promise<RedemptionResolveResponse> {
    try {
      return await this.resolveService.resolveCode(authorization, body);
    } catch (error) {
      if (error instanceof IdentityError) throw identityHttpException(error);
      if (error instanceof IssueError) {
        if (error.code === ISSUE_ERROR_CODES.RESOLVE_DISABLED) {
          throw new HttpException(
            {
              code: RESOLVE_ERROR_CODES.RESOLVE_DISABLED,
              message: error.message,
              requestId: randomUUID(),
              retryable: false,
            } satisfies ApiError,
            503,
          );
        }
        throw resolveHttpException(error);
      }
      if (error instanceof HttpException) throw error;
      throw error;
    }
  }
}

export function buildResolveDeps(
  env: NodeJS.ProcessEnv,
  ticketDeps: TicketServices,
): ResolveServices {
  try {
    return {
      ...ticketDeps,
      env,
      peppers: readSupportedPepperConfigs(env),
      resolveTokenSecret: readResolveTokenSecret(env),
    };
  } catch {
    return {
      ...ticketDeps,
      env,
      peppers: null,
      resolveTokenSecret: null,
    };
  }
}

export { createDatabase };
