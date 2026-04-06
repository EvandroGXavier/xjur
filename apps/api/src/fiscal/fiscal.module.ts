import { Module } from '@nestjs/common';
import { FiscalService } from './fiscal.service';
import { FiscalController } from './fiscal.controller';
import { PrismaService } from '../prisma.service';
import { StockModule } from '../stock/stock.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [StockModule, SecurityModule],
  providers: [FiscalService, PrismaService],
  controllers: [FiscalController],
  exports: [FiscalService],
})
export class FiscalModule {}
