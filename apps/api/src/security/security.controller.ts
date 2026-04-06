import { Controller, Get, Post, Put, Delete, Body, Query, Param, UseGuards, Request, ForbiddenException, UnauthorizedException, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { SecurityService } from './security.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

@Controller('security')
@UseGuards(JwtAuthGuard)
export class SecurityController {
  constructor(
    private readonly securityService: SecurityService,
    private readonly authService: AuthService,
  ) {}

  @Post('re-auth')
  async reAuth(@Request() req: any, @Body() body: { password: string }) {
    // Apenas Admin ou Owner podem sequer tentar o re-auth por segurança
    const allowedRoles = ['ADMIN', 'OWNER'];
    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenException('Apenas Administradores podem acessar a área de sigilo.');
    }

    const isValid = await this.authService.verifyPassword(req.user.userId, body.password);
    if (!isValid) {
      throw new UnauthorizedException('Senha incorreta.');
    }

    return { ok: true, expiresAt: new Date(Date.now() + 5 * 60 * 1000) }; // 5 minutos
  }

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
    if (!['ADMIN', 'OWNER'].includes(req.user.role)) {
      throw new ForbiddenException('Acesso negado aos segredos.');
    }
    return this.securityService.listSecrets(req.user.tenantId, entityType, entityId);
  }

  @Post('secrets')
  async createSecret(@Request() req: any, @Body() data: any) {
    if (!['ADMIN', 'OWNER'].includes(req.user.role)) {
      throw new ForbiddenException('Acesso negado aos segredos.');
    }
    return this.securityService.createSecret(req.user.tenantId, data);
  }

  @Put('secrets/:id')
  async updateSecret(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    if (!['ADMIN', 'OWNER'].includes(req.user.role)) {
      throw new ForbiddenException('Acesso negado aos segredos.');
    }
    return this.securityService.updateSecret(id, req.user.tenantId, data);
  }

  @Delete('secrets/:id')
  async deleteSecret(@Request() req: any, @Param('id') id: string) {
    if (!['ADMIN', 'OWNER'].includes(req.user.role)) {
      throw new ForbiddenException('Acesso negado aos segredos.');
    }
    return this.securityService.deleteSecret(id, req.user.tenantId);
  }

  @Post('secrets/:id/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@Request() req: any, @Param('id') id: string, @UploadedFile() file: any) {
    if (!['ADMIN', 'OWNER'].includes(req.user.role)) {
      throw new ForbiddenException('Acesso negado aos segredos.');
    }
    return this.securityService.uploadSecretFile(id, req.user.tenantId, file);
  }

  @Get('secrets/:id/download')
  async downloadFile(@Request() req: any, @Param('id') id: string, @Res() res: Response) {
    if (!['ADMIN', 'OWNER'].includes(req.user.role)) {
      throw new ForbiddenException('Acesso negado aos segredos.');
    }
    const { buffer, originalName } = await this.securityService.downloadSecretFile(id, req.user.tenantId);
    
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${originalName}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
