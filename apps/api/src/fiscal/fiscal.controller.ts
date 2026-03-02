import { Controller, Post, UseInterceptors, UploadedFile, UseGuards, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FiscalService } from './fiscal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('fiscal')
@UseGuards(JwtAuthGuard)
export class FiscalController {
  constructor(private readonly fiscalService: FiscalService) {}

  @Post('import-xml')
  @UseInterceptors(FileInterceptor('file'))
  async importXml(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: CurrentUserData) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo de XML enviado.');
    }
    
    if (!user || !user.tenantId) {
      throw new BadRequestException('Erro de contexto: Tenant inválido.');
    }

    try {
      const xmlContent = file.buffer.toString('utf-8');
      const result = await this.fiscalService.processXml(user.tenantId, xmlContent);
      return result;
    } catch (error: any) {
      throw new BadRequestException(`Erro ao processar o XML: ${error.message}`);
    }
  }
}
