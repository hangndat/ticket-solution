import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  Headers,
  HttpCode,
  HttpException,
  Injectable,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { type ApiError } from '@ticket/contracts';
import {
  DeviceTokenError,
  DEVICE_TOKEN_ERROR_CODES,
  IdentityError,
  IDENTITY_ERROR_CODES,
  registerDeviceToken,
  revokeDeviceToken,
  type IdentityUserRepository,
  type OidcVerifier,
  type PrismaClient,
} from '@ticket/backend';
import { identityErrorHttpStatus } from './identity-http-status';

type ReplyLike = { status(code: number): { send(): unknown } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class DeviceTokenRegisterBodyDto {
  @ApiProperty() token!: string;
  @ApiProperty({ enum: ['sandbox', 'production'] })
  environment!: 'sandbox' | 'production';
}

class DeviceTokenRegistrationDto {
  @ApiProperty({ format: 'uuid' }) registrationId!: string;
  @ApiProperty({ enum: ['sandbox', 'production'] })
  environment!: 'sandbox' | 'production';
  @ApiProperty({ description: 'ISO timestamp when registration became active' })
  registeredAt!: string;
}

type Deps = {
  db: PrismaClient | null;
  verifier: OidcVerifier | null;
  users: IdentityUserRepository | null;
  bootError: IdentityError | null;
};

@Injectable()
export class DeviceTokenService {
  constructor(private readonly deps: Deps) {}

  private async actor(authorization: string | undefined) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.verifier || !this.deps.users || !this.deps.db) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Device token services are not configured',
      );
    }
    const verified = await this.deps.verifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity(verified);
  }

  async register(
    authorization: string | undefined,
    body: DeviceTokenRegisterBodyDto | undefined,
  ) {
    const user = await this.actor(authorization);
    return registerDeviceToken(this.deps.db!, {
      userId: user.userId,
      token: body?.token,
      environment: body?.environment,
    });
  }

  async revoke(authorization: string | undefined, registrationId: string) {
    const user = await this.actor(authorization);
    if (!UUID.test(registrationId)) {
      throw new DeviceTokenError(
        DEVICE_TOKEN_ERROR_CODES.REGISTRATION_NOT_FOUND,
        'Registration not found',
      );
    }
    await revokeDeviceToken(this.deps.db!, {
      userId: user.userId,
      registrationId,
    });
    return { ok: true as const };
  }
}

@ApiTags('device-tokens')
@Controller()
export class DeviceTokenController {
  constructor(private readonly devices: DeviceTokenService) {}

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
    if (error instanceof DeviceTokenError) {
      throw new HttpException(
        {
          code: error.code,
          message: error.message,
          requestId: randomUUID(),
          retryable: false,
        } satisfies ApiError,
        error.code === DEVICE_TOKEN_ERROR_CODES.REGISTRATION_NOT_FOUND
          ? 404
          : 422,
      );
    }
    throw error;
  }

  @Post('me/device-tokens')
  @ApiBearerAuth()
  @HttpCode(201)
  @ApiCreatedResponse({ type: DeviceTokenRegistrationDto })
  register(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: DeviceTokenRegisterBodyDto,
  ) {
    return this.devices.register(authorization, body).catch((e) => this.fail(e));
  }

  @Delete('me/device-tokens/:registrationId')
  @ApiBearerAuth()
  @HttpCode(204)
  @ApiNoContentResponse()
  async revoke(
    @Headers('authorization') authorization: string | undefined,
    @Param('registrationId') registrationId: string,
    @Res() reply: ReplyLike,
  ) {
    try {
      await this.devices.revoke(authorization, registrationId);
      reply.status(204).send();
    } catch (error) {
      this.fail(error);
    }
  }
}
