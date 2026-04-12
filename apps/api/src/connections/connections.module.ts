
import { Module } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { ConnectionsController } from './connections.controller';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { PrismaService } from '../prisma.service';
import { TelegramModule } from '../telegram/telegram.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [WhatsappModule, TelegramModule, EmailModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService, PrismaService],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
