import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    return this.authService.login(user, {
      trustDevice: Boolean(loginDto.trustDevice),
      deviceName: loginDto.deviceName,
      deviceToken: loginDto.deviceToken,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || undefined,
    });
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
      return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
      return this.authService.resetPassword(dto.token, dto.password);
  }

  @Get('trusted-devices')
  @UseGuards(JwtAuthGuard)
  listTrustedDevices(@CurrentUser() user: CurrentUserData) {
    return this.authService.listTrustedDevices(user.tenantId, user.userId);
  }

  @Delete('trusted-devices/:id')
  @UseGuards(JwtAuthGuard)
  revokeTrustedDevice(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.authService.revokeTrustedDevice(user.tenantId, user.userId, id);
  }
}
