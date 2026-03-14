import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappGateway } from './whatsapp.gateway';
import { PrismaService } from '../prisma.service';
import { TicketsModule } from '../tickets/tickets.module';
import { EvolutionModule } from '../evolution/evolution.module';
import { AgentModule } from '../agent/agent.module';
import { InboxModule } from '../inbox/inbox.module';

@Module({
  imports: [
    ConfigModule, 
    forwardRef(() => TicketsModule),
    forwardRef(() => EvolutionModule),
    AgentModule,
    forwardRef(() => InboxModule),
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsappGateway, PrismaService],
  exports: [WhatsappService],
})
export class WhatsappModule {}


