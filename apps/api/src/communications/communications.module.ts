
import { Module } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { CommunicationsController } from './communications.controller';
import { TicketsModule } from '../tickets/tickets.module';
import { AgentModule } from '../agent/agent.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [TicketsModule, AgentModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService, PrismaService],
  exports: [CommunicationsService]
})
export class CommunicationsModule {}
