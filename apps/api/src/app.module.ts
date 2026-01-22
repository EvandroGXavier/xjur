import { Module } from '@nestjs/common';
import { PrismaModule } from '@dr-x/database';
import { TemplatesModule } from './templates/templates.module';
import { DocumentsModule } from './documents/documents.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { ContactsModule } from './contacts/contacts.module';

@Module({
  imports: [
    PrismaModule, 
    TemplatesModule,
    DocumentsModule,
    WhatsAppModule,
    ContactsModule,
  ],
})
export class AppModule {}