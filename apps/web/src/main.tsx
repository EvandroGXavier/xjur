import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Habilita CORS para o Frontend conseguir falar com a API
  app.enableCors();
  
  // Ativa validação automática de dados
  app.useGlobalPipes(new ValidationPipe());

  // IMPORTANTE: A porta deve ser 3000 para coincidir com a configuração da VPS
  await app.listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();