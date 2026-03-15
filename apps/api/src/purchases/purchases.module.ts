import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { PrismaService } from '../prisma.service';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [StockModule],
  controllers: [PurchasesController],
  providers: [PurchasesService, PrismaService],
})
export class PurchasesModule {}
