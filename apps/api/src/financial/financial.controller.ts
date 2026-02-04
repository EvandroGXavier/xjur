<<<<<<< HEAD
import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Query } from '@nestjs/common';
import { FinancialService } from './financial.service';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard'; 
// import { CurrentUser } from '../auth/current-user.decorator';
=======
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
import { UpdateFinancialRecordDto } from './dto/update-financial-record.dto';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69

@Controller('financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

<<<<<<< HEAD
  @Get('dashboard')
  async getDashboard(@Query('tenantId') tenantId: string) {
     // TODO: Extract tenantId from JWT
     // For now, allow query param for dev testing
     return this.financialService.getDashboard(tenantId); 
  }

  @Post('accounts')
  async createAccount(@Body() data: any) {
    return this.financialService.createAccount(data);
  }

  @Get('transactions')
  async getTransactions(@Query('tenantId') tenantId: string) {
    return this.financialService.getTransactions(tenantId);
  }

  @Post('transactions')
  async createTransaction(@Body() data: any) {
    return this.financialService.createTransaction(data);
  }
  
  @Get('accounts')
  async getAccounts(@Query('tenantId') tenantId: string) {
      return this.financialService.getAccounts(tenantId);
  }

  @Get('categories')
  async getCategories(@Query('tenantId') tenantId: string) {
      return this.financialService.getCategories(tenantId);
  }

  @Post('categories')
  async createCategory(@Body() data: any) {
      return this.financialService.createCategory(data);
  }

  @Get('settings')
  async getSettings(@Query('tenantId') tenantId: string) {
      return this.financialService.getSettings(tenantId);
  }

  @Put('settings')
  async updateSettings(@Body() data: { tenantId: string, defaultOfficeContactId?: string }) {
      return this.financialService.updateSettings(data.tenantId, data);
=======
  // ==================== FINANCIAL RECORDS ====================

  @Post('records')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  createFinancialRecord(@Body() dto: CreateFinancialRecordDto) {
    return this.financialService.createFinancialRecord(dto);
  }

  @Get('records')
  findAllFinancialRecords(
    @Query('tenantId') tenantId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financialService.findAllFinancialRecords(tenantId, {
      type,
      status,
      category,
      startDate,
      endDate,
    });
  }

  @Get('records/:id')
  findOneFinancialRecord(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.financialService.findOneFinancialRecord(id, tenantId);
  }

  @Put('records/:id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  updateFinancialRecord(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Body() dto: UpdateFinancialRecordDto,
  ) {
    return this.financialService.updateFinancialRecord(id, tenantId, dto);
  }

  @Delete('records/:id')
  deleteFinancialRecord(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.financialService.deleteFinancialRecord(id, tenantId);
  }

  // ==================== BANK ACCOUNTS ====================

  @Post('bank-accounts')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  createBankAccount(@Body() dto: CreateBankAccountDto) {
    return this.financialService.createBankAccount(dto);
  }

  @Get('bank-accounts')
  findAllBankAccounts(@Query('tenantId') tenantId: string) {
    return this.financialService.findAllBankAccounts(tenantId);
  }

  @Get('bank-accounts/:id')
  findOneBankAccount(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.financialService.findOneBankAccount(id, tenantId);
  }

  @Put('bank-accounts/:id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  updateBankAccount(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.financialService.updateBankAccount(id, tenantId, dto);
  }

  @Delete('bank-accounts/:id')
  deleteBankAccount(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.financialService.deleteBankAccount(id, tenantId);
  }

  @Get('contacts')
  getContacts(
    @Query('tenantId') tenantId: string,
    @Query('search') search?: string,
  ) {
    return this.financialService.getContacts(tenantId, search);
  }

  // ==================== DASHBOARD & REPORTS ====================

  @Get('dashboard')
  getDashboard(
    @Query('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financialService.getDashboard(tenantId, startDate, endDate);
  }

  @Get('process/:processId/balance')
  getProcessBalance(
    @Param('processId') processId: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.financialService.getProcessBalance(processId, tenantId);
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
  }
}
