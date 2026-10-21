import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import type { HealthResponse } from '@ticket/contracts';
import { HealthDto } from './identity-dtos';

@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthDto })
  health(): HealthResponse {
    return { status: 'ok', service: 'api', version: '0.1.0' };
  }
}
