import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { PrismaService } from '../prisma.service';
import { MicrosoftGraphService } from '../integrations/microsoft-graph.service';

@Module({
  imports: [], 
  controllers: [DocumentsController],
  providers: [DocumentsService, PrismaService, MicrosoftGraphService],
  exports: [DocumentsService],
})
export class DocumentsModule {}