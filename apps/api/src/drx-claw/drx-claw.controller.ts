import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserData,
} from "../common/decorators/current-user.decorator";
import { DrxClawService } from "./drx-claw.service";

@Controller("drx-claw")
@UseGuards(JwtAuthGuard)
export class DrxClawController {
  constructor(private readonly drxClawService: DrxClawService) {}

  @Get("config")
  getConfig(@CurrentUser() user: CurrentUserData) {
    return this.drxClawService.getConfig(user.tenantId);
  }

  @Post("config")
  saveConfig(@CurrentUser() user: CurrentUserData, @Body() body: any) {
    return this.drxClawService.saveConfig(user.tenantId, body);
  }

  @Post("playground")
  runPlayground(@CurrentUser() user: CurrentUserData, @Body() body: any) {
    return this.drxClawService.runPlayground(user.tenantId, body);
  }
}
