import { Controller, Get, Headers } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { MeResponse } from '@ticket/contracts';
import { IdentityError } from '@ticket/backend';
import { ApiErrorDto, MeDto } from './identity-dtos';
import { toHttpException } from './identity-errors';
import { IdentityService } from './identity.service';

@Controller('me')
export class MeController {
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
