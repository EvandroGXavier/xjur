import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { StockService } from './stock.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('stock')
@UseGuards(JwtAuthGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('balances')
  getBalances(@CurrentUser() user: CurrentUserData) {
    return this.stockService.getBalances(user.tenantId);
  }

  @Get('alerts')
  getAlerts(@CurrentUser() user: CurrentUserData) {
    return this.stockService.getAlerts(user.tenantId);
  }

  @Post(':productId/adjust')
  adjustStock(
    @Param('productId') productId: string,
    @Body() body: { quantity: number, type: 'IN' | 'OUT' | 'ADJUST', reason?: string },
    @CurrentUser() user: CurrentUserData
  ) {
    return this.stockService.adjustStock(user.tenantId, productId, body);
  }
}
