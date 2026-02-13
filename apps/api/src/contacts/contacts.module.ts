
import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { EnrichmentService } from './enrichment.service';
import { ContactsController } from './contacts.controller';
import { ContactsImportService } from './contacts-import.service';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [], // Removing PrismaModule import if not needed/causing issues, sticking to providers
  controllers: [ContactsController],
  providers: [ContactsService, EnrichmentService, ContactsImportService, PrismaService],
  exports: [ContactsService, ContactsImportService], // Exporting for usage in TicketsModule
})
export class ContactsModule {}
