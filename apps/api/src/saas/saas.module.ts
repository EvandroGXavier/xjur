
import { Module } from '@nestjs/common';
import { SaasService } from './saas.service';
import { SaasController } from './saas.controller';
import { PrismaModule } from '@drx/database';
import { MicrosoftGraphService } from '../integrations/microsoft-graph.service';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [PrismaModule],
  controllers: [SaasController],
  providers: [SaasService, MicrosoftGraphService, PrismaService],
})
export class SaasModule {}
