import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import {
  ApiOkResponse,
  ApiProperty,
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import { API_VERSION, type HealthResponse } from '@ticket/contracts';
import { readProcessEnvironment } from '@ticket/backend';

class HealthDto implements HealthResponse {
  @ApiProperty({ enum: ['ok'] }) status!: 'ok';
  @ApiProperty({ enum: ['api'] }) service!: 'api';
  @ApiProperty({ example: '0.1.0' }) version!: string;
}
@Controller('health')
class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthDto })
  health(): HealthResponse {
    return { status: 'ok', service: 'api', version: '0.1.0' };
  }
}
@Module({ controllers: [HealthController] })
class AppModule {}

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
  logging = true,
): Promise<NestFastifyApplication> {
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
      .setTitle('Ticket API — W0 foundation')
      .setVersion('0.1.0')
      .setDescription(
        'Liveness only. Tenant business APIs await verified identity and authorization.',
      )
      .build(),
  );
}
