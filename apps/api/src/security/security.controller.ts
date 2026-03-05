import { Controller, Get, Post, Put, Delete, Body, Query, Param, UseGuards, Request } from '@nestjs/common';
import { SecurityService } from './security.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('security')
@UseGuards(JwtAuthGuard)
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('setting')
  async getSetting(
    @Request() req: any,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return this.securityService.getSetting(req.user.tenantId, entityType, entityId);
  }

  @Post('setting')
  async updateSetting(
    @Request() req: any,
    @Body() body: { entityType: string; entityId: string; observation: string },
  ) {
    return this.securityService.updateSetting(req.user.tenantId, body.entityType, body.entityId, body.observation);
  }

  @Get('secrets')
  async listSecrets(
    @Request() req: any,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return this.securityService.listSecrets(req.user.tenantId, entityType, entityId);
  }

  @Post('secrets')
  async createSecret(@Request() req: any, @Body() data: any) {
    return this.securityService.createSecret(req.user.tenantId, data);
  }

  @Put('secrets/:id')
  async updateSecret(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.securityService.updateSecret(id, req.user.tenantId, data);
  }

  @Delete('secrets/:id')
  async deleteSecret(@Request() req: any, @Param('id') id: string) {
    return this.securityService.deleteSecret(id, req.user.tenantId);
  }
}
