import { forwardRef, Module } from '@nestjs/common';
import { CommunicationsModule } from '../communications/communications.module';
import { PrismaService } from '../prisma.service';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
  imports: [CommunicationsModule],
  controllers: [TelegramController],
  providers: [TelegramService, PrismaService],
  exports: [TelegramService],
})
export class TelegramModule {}
