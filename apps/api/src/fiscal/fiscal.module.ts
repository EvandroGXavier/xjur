import { Module } from '@nestjs/common';
import { FiscalService } from './fiscal.service';
import { FiscalController } from './fiscal.controller';
import { PrismaService } from '../prisma.service';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [StockModule],
  providers: [FiscalService, PrismaService],
  controllers: [FiscalController],
  exports: [FiscalService],
})
export class FiscalModule {}
