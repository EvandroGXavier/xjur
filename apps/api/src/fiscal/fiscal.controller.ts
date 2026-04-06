import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FiscalService } from './fiscal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserData,
} from '../common/decorators/current-user.decorator';

@Controller('fiscal')
@UseGuards(JwtAuthGuard)
export class FiscalController {
  constructor(private readonly fiscalService: FiscalService) {}

  @Get('config')
  getConfig(@CurrentUser() user: CurrentUserData) {
    return this.fiscalService.getConfig(user.tenantId);
  }

  @Put('config')
  updateConfig(
    @Body() body: any,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.fiscalService.updateConfig(user.tenantId, body);
  }

  @Get('invoices')
  listInvoices(@CurrentUser() user: CurrentUserData) {
    return this.fiscalService.listInvoices(user.tenantId);
  }

  @Get('invoices/:id')
  findInvoice(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.fiscalService.findInvoice(user.tenantId, id);
  }

  @Post('invoices/:id/transmit')
  transmitInvoice(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.fiscalService.transmitInvoice(user.tenantId, id);
  }

  @Get('proposals/:id/readiness')
  getProposalReadiness(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.fiscalService.getProposalReadiness(user.tenantId, id);
  }

  @Post('import-xml')
  @UseInterceptors(FileInterceptor('file'))
  async importXml(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserData,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo de XML enviado.');
    }

    if (!user || !user.tenantId) {
      throw new BadRequestException('Erro de contexto: tenant invalido.');
    }

    const xmlContent = file.buffer.toString('utf-8');
    return this.fiscalService.processXml(user.tenantId, xmlContent);
  }
}
