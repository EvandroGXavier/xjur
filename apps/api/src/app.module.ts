import { Module } from '@nestjs/common';
import { PrismaModule } from '@dr-x/database';
import { TemplatesModule } from './templates/templates.module';
import { DocumentsModule } from './documents/documents.module';
import { WhatsappModule } from './whatsapp/whatsapp.module'; // 'a' minúsculo corrigido
import { ContactsModule } from './contacts/contacts.module';

@Module({
  imports: [
    PrismaModule, 
    TemplatesModule,
    DocumentsModule,
    WhatsappModule, // 'a' minúsculo corrigido
    ContactsModule,
  ],
})
export class AppModule {}