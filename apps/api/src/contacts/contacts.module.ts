import { Module, forwardRef } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactNormalizationService } from './contact-normalization.service';
import { ContactDeduplicationService } from './contact-deduplication.service';
import { ChannelIdentifiersMigrationService } from './channel-identifiers-migration.service';
import { EnrichmentService } from './enrichment.service';
import { ContactsController } from './contacts.controller';
import { ContactsImportService } from './contacts-import.service';
import { PrismaService } from '../prisma.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [forwardRef(() => WhatsappModule)],
  controllers: [ContactsController],
  providers: [
    ContactsService,
    ContactNormalizationService,
    ContactDeduplicationService,
    ChannelIdentifiersMigrationService,
    EnrichmentService,
    ContactsImportService,
    PrismaService,
  ],
  exports: [
    ContactsService,
    ContactNormalizationService,
    ContactDeduplicationService,
    ContactsImportService,
    EnrichmentService,
  ],
})
export class ContactsModule {}
