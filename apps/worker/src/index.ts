import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { readProcessEnvironment } from '@ticket/backend';
@Module({})
class WorkerModule {}
export async function createWorker(
  env: NodeJS.ProcessEnv = process.env,
  logging = true,
) {
  readProcessEnvironment(env);
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: logging ? undefined : false,
  });
  app.enableShutdownHooks();
  return app;
}
