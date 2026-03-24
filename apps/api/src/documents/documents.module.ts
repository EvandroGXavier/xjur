import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { PrismaService } from '../prisma.service';
import { MicrosoftGraphService } from '../integrations/microsoft-graph.service';
import { DrxClawModule } from '../drx-claw/drx-claw.module';

@Module({
  imports: [DrxClawModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, PrismaService, MicrosoftGraphService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
