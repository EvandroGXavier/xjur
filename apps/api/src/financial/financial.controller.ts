import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import {
  CreateFinancialRecordDto,
  CreateInstallmentsDto,
  CreateTransactionSplitDto,
  PartialPaymentDto,
  SettleRecordDto,
} from './dto/create-financial-record.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { UpdateFinancialRecordDto } from './dto/update-financial-record.dto';
import { FinancialService } from './financial.service';

@Controller('financial')
@UseGuards(JwtAuthGuard)
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  // ==================== FINANCIAL RECORDS ====================

  @Post('records')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  createFinancialRecord(
    @Body() dto: CreateFinancialRecordDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.financialService.createFinancialRecord({ ...dto, tenantId: user.tenantId });
  }

  @Get('records')
  findAllFinancialRecords(
    @CurrentUser() user: CurrentUserData,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('processId') processId?: string,
    @Query('parentId') parentId?: string,
    @Query('showInstallments') showInstallments?: string,
  ) {
    return this.financialService.findAllFinancialRecords(user.tenantId, {
      type,
      status,
      category,
      startDate,
      endDate,
      processId,
      parentId,
      showInstallments: showInstallments === 'true',
    });
  }

  @Get('records/:id/attachments/:filename')
  async downloadAttachment(
    @Param('id') id: string,
    @Param('filename') filename: string,
    @CurrentUser() user: CurrentUserData,
    @Res() res: Response,
  ) {
    const attachment = await this.financialService.getAttachmentForRecord(id, user.tenantId, filename);
    const fs = require('fs');

    if (!fs.existsSync(attachment.filePath)) {
      console.error(`File request failed. Path not found: ${attachment.filePath}`);
      return res.status(404).json({ message: 'Arquivo não encontrado' });
    }

    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${attachment.originalName || attachment.fileName}"`,
    );
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');

    return res.sendFile(attachment.filePath);
  }

  @Get('records/:id')
  findOneFinancialRecord(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.financialService.findOneFinancialRecord(id, user.tenantId);
  }

  @Put('records/:id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  updateFinancialRecord(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateFinancialRecordDto,
  ) {
    return this.financialService.updateFinancialRecord(id, user.tenantId, dto);
  }

  @Post('records/:id/attachments')
  @UseInterceptors(FilesInterceptor('attachments'))
  async uploadAttachments(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @UploadedFiles() files: Array<any>,
  ) {
    return this.financialService.uploadAttachments(id, user.tenantId, files);
  }

  @Delete('records/:id')
  deleteFinancialRecord(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.financialService.deleteFinancialRecord(id, user.tenantId);
  }

  // ==================== PARCELAMENTO ====================

  @Post('installments')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  createInstallments(@Body() dto: CreateInstallmentsDto, @CurrentUser() user: CurrentUserData) {
    return this.financialService.createInstallments({ ...dto, tenantId: user.tenantId });
  }

  // ==================== PAGAMENTO PARCIAL ====================

  @Post('records/:id/partial-payment')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  processPartialPayment(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: PartialPaymentDto,
  ) {
    return this.financialService.processPartialPayment(id, { ...dto, tenantId: user.tenantId });
  }

  // ==================== LIQUIDAÇÃO COM ENCARGOS ====================

  @Post('records/:id/settle')
  @UseInterceptors(FilesInterceptor('attachments'))
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  settleRecord(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: SettleRecordDto,
    @UploadedFiles() files: Array<any>,
  ) {
    return this.financialService.settleRecord(id, { ...dto, tenantId: user.tenantId }, files);
  }

  // ==================== RATEIO (SPLITS) ====================

  @Post('records/:id/splits')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  createSplits(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() splits: CreateTransactionSplitDto[],
  ) {
    return this.financialService.createSplits(id, user.tenantId, splits);
  }

  @Get('records/:id/splits')
  getSplits(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.financialService.getSplits(id, user.tenantId);
  }

  // ==================== PARTES DA TRANSAÇÃO (FINANCIAL PARTIES) ====================

  @Get('records/:id/parties')
  findParties(
    @Param('id') recordId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.financialService.findPartiesByRecord(recordId, user.tenantId);
  }

  @Post('records/:id/parties')
  addParty(
    @Param('id') recordId: string,
    @CurrentUser() user: CurrentUserData,
    @Body() body: { contactId: string; role: string; amount?: number; notes?: string },
  ) {
    return this.financialService.addPartyToRecord(recordId, user.tenantId, body);
  }

  @Post('records/:id/parties/quick-contact')
  addPartyWithQuickContact(
    @Param('id') recordId: string,
    @CurrentUser() user: CurrentUserData,
    @Body()
    body: {
      name: string;
      document?: string;
      phone?: string;
      email?: string;
      personType?: string;
      role: string;
      amount?: number;
    },
  ) {
    return this.financialService.addPartyWithQuickContact(recordId, user.tenantId, body);
  }

  @Delete('records/:id/parties/:partyId')
  removeParty(
    @Param('id') recordId: string,
    @Param('partyId') partyId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.financialService.removePartyFromRecord(partyId, user.tenantId);
  }

  // ==================== CATEGORIAS FINANCEIRAS ====================

  @Post('categories')
  createCategory(
    @Body() data: { name: string; type?: string; color?: string; icon?: string; parentId?: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.financialService.createCategory(user.tenantId, data);
  }

  @Get('categories')
  findAllCategories(
    @CurrentUser() user: CurrentUserData,
    @Query('type') type?: string,
  ) {
    return this.financialService.findAllCategories(user.tenantId, type);
  }

  @Delete('categories/:id')
  deleteCategory(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.financialService.deleteCategory(id, user.tenantId);
  }

  // ==================== BANK ACCOUNTS ====================

  @Post('bank-accounts')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  createBankAccount(@Body() dto: CreateBankAccountDto, @CurrentUser() user: CurrentUserData) {
    return this.financialService.createBankAccount({ ...dto, tenantId: user.tenantId });
  }

  @Get('bank-accounts')
  findAllBankAccounts(@CurrentUser() user: CurrentUserData) {
    return this.financialService.findAllBankAccounts(user.tenantId);
  }

  @Get('bank-accounts/:id')
  findOneBankAccount(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.financialService.findOneBankAccount(id, user.tenantId);
  }

  @Put('bank-accounts/:id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  updateBankAccount(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.financialService.updateBankAccount(id, user.tenantId, dto);
  }

  @Delete('bank-accounts/:id')
  deleteBankAccount(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.financialService.deleteBankAccount(id, user.tenantId);
  }

  @Get('contacts')
  getContacts(
    @CurrentUser() user: CurrentUserData,
    @Query('search') search?: string,
  ) {
    return this.financialService.getContacts(user.tenantId, search);
  }

  @Get('processes')
  getProcesses(
    @CurrentUser() user: CurrentUserData,
    @Query('search') search?: string,
  ) {
    return this.financialService.getProcesses(user.tenantId, search);
  }

  // ==================== DASHBOARD & REPORTS ====================

  @Get('dashboard')
  getDashboard(
    @CurrentUser() user: CurrentUserData,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('processId') processId?: string,
  ) {
    return this.financialService.getDashboard(user.tenantId, startDate, endDate, processId);
  }

  @Get('process/:processId/balance')
  getProcessBalance(
    @Param('processId') processId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.financialService.getProcessBalance(processId, user.tenantId);
  }
}
