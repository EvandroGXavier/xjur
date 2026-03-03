import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from "@nestjs/common";
import { PaymentConditionsService } from "./payment-conditions.service";
import { CreatePaymentConditionDto } from "./dto/create-payment-condition.dto";
import { UpdatePaymentConditionDto } from "./dto/update-payment-condition.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserData,
} from "../common/decorators/current-user.decorator";

@Controller("payment-conditions")
@UseGuards(JwtAuthGuard)
export class PaymentConditionsController {
  constructor(
    private readonly paymentConditionsService: PaymentConditionsService,
  ) {}

  @Post()
  create(
    @Body() createDto: CreatePaymentConditionDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    if (!user || !user.tenantId) throw new Error("User context invalid");
    return this.paymentConditionsService.create(createDto, user.tenantId);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) throw new Error("User context invalid");
    return this.paymentConditionsService.findAll(user.tenantId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) throw new Error("User context invalid");
    return this.paymentConditionsService.findOne(id, user.tenantId);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateDto: UpdatePaymentConditionDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    if (!user || !user.tenantId) throw new Error("User context invalid");
    return this.paymentConditionsService.update(id, updateDto, user.tenantId);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) throw new Error("User context invalid");
    return this.paymentConditionsService.remove(id, user.tenantId);
  }
}
