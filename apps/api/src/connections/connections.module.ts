
import { Module } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { ConnectionsController } from './connections.controller';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [WhatsappModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService, PrismaService],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
