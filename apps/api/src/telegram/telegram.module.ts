import { forwardRef, Module } from '@nestjs/common';
import { DrxClawModule } from '../drx-claw/drx-claw.module';
import { PrismaService } from '../prisma.service';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
  imports: [forwardRef(() => DrxClawModule)],
  controllers: [TelegramController],
  providers: [TelegramService, PrismaService],
  exports: [TelegramService],
})
export class TelegramModule {}
