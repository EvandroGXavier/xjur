import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORREÇÃO CRÍTICA: Aumenta o limite para suportar Webhooks pesados da Evolution API
  // e uploads reais de PDFs pesados (ex: 100MB+) em Andamentos.
  app.use(json({ limit: '500mb' }));
  app.use(urlencoded({ extended: true, limit: '500mb' }));

  app.enableCors();
  
  // Mantém o padrão de rotas do sistema
  app.setGlobalPrefix('api');
  
  // Serve arquivos estáticos (PDFs, Áudios de processos, etc)
  app.use('/storage', express.static(join(process.cwd(), 'storage')));

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Porta padrão da API do DR.X
  await app.listen(3000);
  console.log(`🚀 DR.X API está rodando em: http://localhost:3000/api`);
}
bootstrap();