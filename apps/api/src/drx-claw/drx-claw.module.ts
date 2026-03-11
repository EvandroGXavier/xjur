import { Module } from "@nestjs/common";
import { DrxClawController } from "./drx-claw.controller";
import { DrxClawService } from "./drx-claw.service";
import { PrismaService } from "../prisma.service";

@Module({
  controllers: [DrxClawController],
  providers: [DrxClawService, PrismaService],
})
export class DrxClawModule {}
