import { Module } from '@nestjs/common';
import { EventProcessorService } from './event-processor.service';
import { PrismaService } from '../prisma.service';
import { TicketsModule } from '../tickets/tickets.module';
import { FinancialModule } from '../financial/financial.module';

@Module({
  imports: [TicketsModule, FinancialModule],
  providers: [EventProcessorService, PrismaService],
  exports: [EventProcessorService],
})
export class EventProcessorModule {}
