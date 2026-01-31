import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ContactsModule } from './contacts/contacts.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { FinancialModule } from './financial/financial.module';
import { SaasModule } from './saas/saas.module';

@Module({
  imports: [
    AuthModule,      // Reativa o sistema de Login
    ContactsModule,  // Gestão de Clientes
    WhatsappModule,  // Conexão Baileys
    FinancialModule, // Módulo Financeiro
    SaasModule       // Controle de Assinaturas
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}