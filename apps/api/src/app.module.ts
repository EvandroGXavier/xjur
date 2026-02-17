import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, HttpAdapterHost } from '@nestjs/core';
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
import { CommunicationsModule } from './communications/communications.module';
import { ConnectionsModule } from './connections/connections.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // Carrega .env globalmente
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
    CommunicationsModule, // Webhook de entrada
    ConnectionsModule, // Gestão de Conexões (WhatsApp, Instagram, Email)
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    // The HttpAdapterHost is required for the filter, it should be available by default but explicit can be cleaner
    // However, NestJS usually provides it automatically when using useClass
  ],
})
export class AppModule {}