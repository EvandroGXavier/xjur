
import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { PrismaService } from '../prisma.service';
import { ContactsModule } from '../contacts/contacts.module'; // If needed for future expansion

@Module({
  imports: [ContactsModule],
  controllers: [TicketsController],
  providers: [TicketsService, PrismaService],
  exports: [TicketsService],
})
export class TicketsModule {}
