
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

  // @UseGuards(JwtAuthGuard)
  @Get('tenants')
  async findAll() {
    return this.saasService.getTenants();
  }

  // @UseGuards(JwtAuthGuard)
  @Post('tenants/:id') // Using Post for update if Put has issues on some proxies, but standard is Put. Let's use PUT and PATCH.
  // Actually NestJS uses @Put
  async updateTenantHack(@Request() req: any, @Body() body: any) {
       // Placeholder if needed
  }

  @Post('tenants/update/:id') // Safe fallback
  async updateTenantPost(@Request() req: any, @Body() body: any) {
    return this.saasService.updateTenant(req.params.id, body);
  }
  
  // Standard REST
  // @UseGuards(JwtAuthGuard)
  // @Put('tenants/:id')
  // async updateTenant(@Param('id') id: string, @Body() body: any) {
  //   return this.saasService.updateTenant(id, body);
  // }
  
  // Using explicit params for simplicity with the current structure
  @Post('tenants/delete/:id')
  async deleteTenant(@Request() req: any) {
      return this.saasService.deleteTenant(req.params.id);
  }

  // --- PLANS ---

  @Get('plans')
  async getPlans() {
      return this.saasService.getPlans();
  }

  @Post('plans')
  async createPlan(@Body() body: any) {
      return this.saasService.createPlan(body);
  }

  @Post('plans/update/:id')
  async updatePlan(@Request() req: any, @Body() body: any) {
      return this.saasService.updatePlan(req.params.id, body);
  }

  @Post('plans/delete/:id')
  async deletePlan(@Request() req: any) {
      return this.saasService.deletePlan(req.params.id);
  }
}
