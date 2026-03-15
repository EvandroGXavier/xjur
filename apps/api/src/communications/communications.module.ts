import { forwardRef, Module } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { CommunicationsController } from './communications.controller';
import { TicketsModule } from '../tickets/tickets.module';
import { AgentModule } from '../agent/agent.module';
import { PrismaService } from '../prisma.service';
import { InboxModule } from '../inbox/inbox.module';

@Module({
  imports: [forwardRef(() => TicketsModule), AgentModule, InboxModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService, PrismaService],
  exports: [CommunicationsService]
})
export class CommunicationsModule {}
