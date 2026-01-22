import { Module } from '@nestjs/common';
import { PrismaModule } from '@dr-x/database';
import { TemplatesModule } from './templates/templates.module';
import { DocumentsModule } from './documents/documents.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ContactsModule } from './contacts/contacts.module';

@Module({
  imports: [
    PrismaModule,     // Carrega primeiro para ser global
    TemplatesModule,
    DocumentsModule,
    WhatsappModule,
    ContactsModule,
  ],
})
export class AppModule {}