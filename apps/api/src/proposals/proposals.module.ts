import { Module } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { ProposalsController } from './proposals.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [ProposalsService, PrismaService],
  controllers: [ProposalsController],
  exports: [ProposalsService],
})
export class ProposalsModule {}
