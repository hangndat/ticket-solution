import { ApiProperty } from '@nestjs/swagger';
import type { ApiError, HealthResponse, MeResponse } from '@ticket/contracts';

export class HealthDto implements HealthResponse {
  @ApiProperty({ enum: ['ok'] }) status!: 'ok';
  @ApiProperty({ enum: ['api'] }) service!: 'api';
  @ApiProperty({ example: '0.1.0' }) version!: string;
}

export class MeDto implements MeResponse {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() issuer!: string;
  @ApiProperty() subject!: string;
  @ApiProperty({ nullable: true, type: String }) email!: string | null;
  @ApiProperty() emailVerified!: boolean;
}

export class ApiErrorDto implements ApiError {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiProperty() requestId!: string;
  @ApiProperty({ required: false }) operationId?: string;
  @ApiProperty() retryable!: boolean;
}
