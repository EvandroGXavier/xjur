import { Module } from "@nestjs/common";
import { PaymentConditionsService } from "./payment-conditions.service";
import { PaymentConditionsController } from "./payment-conditions.controller";
import { PrismaService } from "../prisma.service";

@Module({
  controllers: [PaymentConditionsController],
  providers: [PaymentConditionsService, PrismaService],
  exports: [PaymentConditionsService],
})
export class PaymentConditionsModule {}
