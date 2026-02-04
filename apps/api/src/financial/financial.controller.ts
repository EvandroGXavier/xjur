import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Query } from '@nestjs/common';
import { FinancialService } from './financial.service';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard'; 
// import { CurrentUser } from '../auth/current-user.decorator';

@Controller('financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

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
  }
}
