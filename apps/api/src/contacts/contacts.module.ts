import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { EnrichmentService } from './enrichment.service';
import { ContactsController } from './contacts.controller';
import { PrismaModule } from '@dr-x/database';

@Module({
  imports: [PrismaModule],
  controllers: [ContactsController],
  providers: [ContactsService, EnrichmentService],
})
export class ContactsModule {}
