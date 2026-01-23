import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../packages/database/dist/index.js';
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

