import { Module, forwardRef } from '@nestjs/common';
import { EventProcessorService } from './event-processor.service';
import { PrismaService } from '../prisma.service';
import { TicketsModule } from '../tickets/tickets.module';
import { FinancialModule } from '../financial/financial.module';
import { InboxModule } from '../inbox/inbox.module';

@Module({
  imports: [TicketsModule, FinancialModule, forwardRef(() => InboxModule)],
  providers: [EventProcessorService, PrismaService],
  exports: [EventProcessorService],
})
export class EventProcessorModule {}
