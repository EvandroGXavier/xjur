import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  // app.setGlobalPrefix('api'); // Note: if static files are served at /storage, they won't have /api prefix.
                              // But controller routes have /api prefix?
  // Check if existing controllers assume /api base. Yes, usually setGlobalPrefix('api') is good practice.
  // But static files can be outside /api.

  app.setGlobalPrefix('api');
  
  // Serve static files
  app.use('/storage', express.static(join(process.cwd(), 'storage')));

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  await app.listen(3000);
}
bootstrap();