import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
import { UpdateFinancialRecordDto } from './dto/update-financial-record.dto';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';

@Controller('financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  // ==================== FINANCIAL RECORDS ====================

  @Post('records')
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
  }
}
