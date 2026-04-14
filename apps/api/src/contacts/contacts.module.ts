import { Module, forwardRef } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ChannelIdentifiersMigrationService } from './channel-identifiers-migration.service';
import { EnrichmentService } from './enrichment.service';
import { ContactsController } from './contacts.controller';
import { ContactsImportService } from './contacts-import.service';
import { PrismaService } from '../prisma.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [forwardRef(() => WhatsappModule)],
  controllers: [ContactsController],
  providers: [ContactsService, ChannelIdentifiersMigrationService, EnrichmentService, ContactsImportService, PrismaService],
  exports: [ContactsService, ContactsImportService, EnrichmentService],
})
export class ContactsModule {}
