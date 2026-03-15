import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { TelegramService } from '../src/telegram/telegram.service';
import { PrismaClient } from '@prisma/client';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const telegramService = app.get(TelegramService);
  const prisma = new PrismaClient();

  try {
    const connections = await prisma.connection.findMany({
      where: { type: 'TELEGRAM', status: 'CONNECTED' }
    });

    console.log(`[Telegram Sync] Encontradas ${connections.length} conexões ativas.`);

    for (const conn of connections) {
      try {
        console.log(`[Telegram Sync] Sincronizando webhook para: ${conn.name} (${conn.id})...`);
        await telegramService.connect(conn.id);
        console.log(`[Telegram Sync] ✅ ${conn.name} sincronizado.`);
      } catch (err: any) {
        console.error(`[Telegram Sync] ❌ Erro ao sincronizar ${conn.name}:`, err.message);
      }
    }
  } catch (error: any) {
    console.error('[Telegram Sync] ❌ Erro fatal:', error.message);
  } finally {
    await prisma.$disconnect();
    await app.close();
  }
}

bootstrap();
