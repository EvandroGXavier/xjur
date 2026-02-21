import { Controller, Get, Post, Put, Delete, Body, Param, Query, UsePipes, ValidationPipe, UseGuards } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { CreateFinancialRecordDto, CreateInstallmentsDto, PartialPaymentDto, SettleRecordDto, CreateTransactionSplitDto } from './dto/create-financial-record.dto';
import { UpdateFinancialRecordDto } from './dto/update-financial-record.dto';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('financial')
@UseGuards(JwtAuthGuard)
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  // ==================== FINANCIAL RECORDS ====================

  @Post('records')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  createFinancialRecord(@Body() dto: CreateFinancialRecordDto, @CurrentUser() user: CurrentUserData) {
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
    @Query('parentId') parentId?: string,
    @Query('showInstallments') showInstallments?: string,
  ) {
    return this.financialService.findAllFinancialRecords(user.tenantId, {
      type,
      status,
      category,
      startDate,
      endDate,
      parentId,
      showInstallments: showInstallments === 'true',
    });
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
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  settleRecord(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: SettleRecordDto,
  ) {
    return this.financialService.settleRecord(id, { ...dto, tenantId: user.tenantId });
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

  // ==================== DASHBOARD & REPORTS ====================

  @Get('dashboard')
  getDashboard(
    @CurrentUser() user: CurrentUserData,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financialService.getDashboard(user.tenantId, startDate, endDate);
  }

  @Get('process/:processId/balance')
  getProcessBalance(
    @Param('processId') processId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.financialService.getProcessBalance(processId, user.tenantId);
  }
}
