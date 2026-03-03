import { PartialType } from "@nestjs/mapped-types";
import { CreatePaymentConditionDto } from "./create-payment-condition.dto";

export class UpdatePaymentConditionDto extends PartialType(
  CreatePaymentConditionDto,
) {}
