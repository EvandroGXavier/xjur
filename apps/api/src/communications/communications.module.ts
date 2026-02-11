
import { Module } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { CommunicationsController } from './communications.controller';
import { TicketsModule } from '../tickets/tickets.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [TicketsModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService, PrismaService],
  exports: [CommunicationsService]
})
export class CommunicationsModule {}
