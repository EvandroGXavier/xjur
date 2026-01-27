
import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { SaasService } from './saas.service';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Criar se nao existir

@Controller('saas')
export class SaasController {
  constructor(private readonly saasService: SaasService) {}

  @Post('register')
  async register(@Body() body: any) {
    // Body: { name, email, document, mobile, password }
    return this.saasService.registerTenant(body);
  }

  // @UseGuards(JwtAuthGuard) // Proteger depois
  @Get('tenants')
  async findAll() {
    return this.saasService.getTenants();
  }
}
