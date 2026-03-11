import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [AgentService, PrismaService],
  exports: [AgentService],
})
export class AgentModule {}
