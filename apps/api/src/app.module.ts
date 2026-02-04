import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ContactsModule } from './contacts/contacts.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { FinancialModule } from './financial/financial.module';
import { SaasModule } from './saas/saas.module';
<<<<<<< HEAD
=======
import { DocumentsModule } from './documents/documents.module';
import { UsersModule } from './users/users.module';
import { ProcessesModule } from './processes/processes.module';
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69

@Module({
  imports: [
    AuthModule,      // Reativa o sistema de Login
    ContactsModule,  // Gestão de Clientes
    WhatsappModule,  // Conexão Baileys
    FinancialModule, // Módulo Financeiro
<<<<<<< HEAD
    SaasModule       // Controle de Assinaturas
=======
    SaasModule,      // Controle de Assinaturas
    DocumentsModule, // Biblioteca de Documentos
    UsersModule,
    ProcessesModule, // Automator de Processos
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}