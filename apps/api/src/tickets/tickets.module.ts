
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { TicketsGateway } from './tickets.gateway';
import { PrismaService } from '../prisma.service';
import { ContactsModule } from '../contacts/contacts.module';
import { TelegramModule } from '../telegram/telegram.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [ConfigModule, ContactsModule, AgentModule, forwardRef(() => WhatsappModule), forwardRef(() => TelegramModule)],
  controllers: [TicketsController],
  providers: [TicketsService, TicketsGateway, PrismaService],
  exports: [TicketsService, TicketsGateway],
})
export class TicketsModule {}

