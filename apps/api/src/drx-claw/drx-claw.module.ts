import { forwardRef, Module } from "@nestjs/common";
import { DrxClawController } from "./drx-claw.controller";
import { DrxClawService } from "./drx-claw.service";
import { TriagemService } from "./triagem.service";
import { PrismaService } from "../prisma.service";
import { CommunicationsModule } from "../communications/communications.module";
import { TicketsModule } from "../tickets/tickets.module";
import { TelegramModule } from "../telegram/telegram.module";
import { WhatsappModule } from "../whatsapp/whatsapp.module";
import { InboxModule } from "../inbox/inbox.module";

@Module({
  imports: [
    forwardRef(() => CommunicationsModule),
    forwardRef(() => TicketsModule),
    forwardRef(() => TelegramModule),
    forwardRef(() => WhatsappModule),
    forwardRef(() => InboxModule),
  ],
  controllers: [DrxClawController],
  providers: [DrxClawService, TriagemService, PrismaService],
  exports: [DrxClawService, TriagemService],
})
export class DrxClawModule {}
