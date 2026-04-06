import { Module } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { ProposalsController } from './proposals.controller';
import { PrismaService } from '../prisma.service';
import { StockModule } from '../stock/stock.module';
import { FiscalModule } from '../fiscal/fiscal.module';

@Module({
  imports: [StockModule, FiscalModule],
  providers: [ProposalsService, PrismaService],
  controllers: [ProposalsController],
  exports: [ProposalsService],
})
export class ProposalsModule {}
