import { forwardRef, Module } from '@nestjs/common';
import { CommunicationsModule } from '../communications/communications.module';
import { DrxClawModule } from '../drx-claw/drx-claw.module';
import { PrismaService } from '../prisma.service';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
  imports: [CommunicationsModule, forwardRef(() => DrxClawModule)],
  controllers: [TelegramController],
  providers: [TelegramService, PrismaService],
  exports: [TelegramService],
})
export class TelegramModule {}
