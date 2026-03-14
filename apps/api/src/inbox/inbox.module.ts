import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { InboxController } from './inbox.controller';
import { InboxGateway } from './inbox.gateway';
import { InboxService } from './inbox.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [ConfigModule, forwardRef(() => WhatsappModule)],
  controllers: [InboxController],
  providers: [InboxService, InboxGateway, PrismaService],
  exports: [InboxService, InboxGateway],
})
export class InboxModule {}
