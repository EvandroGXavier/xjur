import { Module } from '@nestjs/common';
import { FiscalService } from './fiscal.service';
import { FiscalController } from './fiscal.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [FiscalService, PrismaService],
  controllers: [FiscalController],
  exports: [FiscalService],
})
export class FiscalModule {}
