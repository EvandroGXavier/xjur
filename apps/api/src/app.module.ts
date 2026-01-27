import { Module } from '@nestjs/common';
import { PrismaModule } from '@drx/database';
import { TemplatesModule } from './templates/templates.module';
import { DocumentsModule } from './documents/documents.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ContactsModule } from './contacts/contacts.module';
import { AuthModule } from './auth/auth.module';
import { SaasModule } from './saas/saas.module';

@Module({
  imports: [
    PrismaModule,     // Carrega primeiro para ser global
    AuthModule,
    SaasModule,
    TemplatesModule,
    DocumentsModule,
    WhatsappModule,
    ContactsModule,
  ],
})
export class AppModule {}
