import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ContactsModule } from './contacts/contacts.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { FinancialModule } from './financial/financial.module';
import { SaasModule } from './saas/saas.module';
import { DocumentsModule } from './documents/documents.module';
import { UsersModule } from './users/users.module';
import { ProcessesModule } from './processes/processes.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { TicketsModule } from './tickets/tickets.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    AuthModule,      // Reativa o sistema de Login
    ContactsModule,  // Gestão de Clientes
    WhatsappModule,  // Conexão Baileys
    FinancialModule, // Módulo Financeiro
    SaasModule,      // Controle de Assinaturas
    DocumentsModule, // Biblioteca de Documentos
    UsersModule,
    ProcessesModule, // Automator de Processos
    AppointmentsModule, // Agenda e Prazos
    TicketsModule, // Omnichannel, Chat, Chamados
    ProductsModule, // Estoque e Produtos
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}