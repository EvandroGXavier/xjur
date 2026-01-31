import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  
  // Configurar validação global
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,           // Remove propriedades não definidas no DTO
    forbidNonWhitelisted: true, // Retorna erro se propriedades extras forem enviadas
    transform: true,            // Transforma payloads em instâncias de DTO
    transformOptions: {
      enableImplicitConversion: true, // Converte tipos automaticamente
    },
  }));
  
  await app.listen(3000);
  console.log('Application is running on: http://localhost:3000');
}
bootstrap();