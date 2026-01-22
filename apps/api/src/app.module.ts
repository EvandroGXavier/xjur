import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ContactsModule } from './contacts/contacts.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { TemplatesModule } from './templates/templates.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [ContactsModule, WhatsappModule, TemplatesModule, DocumentsModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
