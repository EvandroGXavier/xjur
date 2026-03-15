import { forwardRef, Module } from "@nestjs/common";
import { DrxClawController } from "./drx-claw.controller";
import { DrxClawService } from "./drx-claw.service";
import { PrismaService } from "../prisma.service";
import { CommunicationsModule } from "../communications/communications.module";
import { TicketsModule } from "../tickets/tickets.module";
import { TelegramModule } from "../telegram/telegram.module";

@Module({
  imports: [
    forwardRef(() => CommunicationsModule),
    forwardRef(() => TicketsModule),
    forwardRef(() => TelegramModule)
  ],
  controllers: [DrxClawController],
  providers: [DrxClawService, PrismaService],
  exports: [DrxClawService],
})
export class DrxClawModule {}
