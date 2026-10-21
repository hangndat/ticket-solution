import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MeEventsDto } from './platform-dtos';
import { PlatformService } from './platform.service';

@ApiTags('platform')
@Controller()
export class PlatformMeController {
  constructor(private readonly platform: PlatformService) {}

  @Get('platform/me')
  @ApiBearerAuth()
  platformMe(@Headers('authorization') authorization: string | undefined) {
    return this.platform.me(authorization);
  }

  @Get('me/tenants')
  @ApiBearerAuth()
  myTenants(@Headers('authorization') authorization: string | undefined) {
    return this.platform.myTenants(authorization);
  }

  @Get('me/events')
  @ApiBearerAuth()
  @ApiOkResponse({ type: MeEventsDto })
  myEvents(@Headers('authorization') authorization: string | undefined) {
    return this.platform.myEvents(authorization);
  }

  @Post('me/membership-invites/accept')
  @ApiBearerAuth()
  accept(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { token: string },
  ) {
    return this.platform.acceptInvite(authorization, body);
  }

  @Post('me/account-deletion-requests')
  @ApiBearerAuth()
  requestDeletion(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { confirmation: true },
  ) {
    return this.platform.requestDeletion(authorization, body);
  }

  @Get('me/account-deletion-requests/current')
  @ApiBearerAuth()
  currentDeletion(@Headers('authorization') authorization: string | undefined) {
    return this.platform.currentDeletion(authorization);
  }
}
