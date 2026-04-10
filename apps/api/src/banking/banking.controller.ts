import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserData,
} from '../common/decorators/current-user.decorator';
import { BankingService } from './banking.service';
import { CreateBankIntegrationDto } from './dto/create-bank-integration.dto';
import { UpdateBankIntegrationDto } from './dto/update-bank-integration.dto';
import { SyncBankIntegrationDto } from './dto/sync-bank-integration.dto';
import { ReconcileBankTransactionDto } from './dto/reconcile-bank-transaction.dto';
import { CreateBankChargeDto } from './dto/create-bank-charge.dto';
import { CreateBankPaymentRequestDto } from './dto/create-bank-payment-request.dto';
import { ReceiveBankWebhookDto } from './dto/receive-bank-webhook.dto';

@Controller('banking')
@UseGuards(JwtAuthGuard)
export class BankingController {
  constructor(private readonly bankingService: BankingService) {}

  @Get('integrations')
  listIntegrations(@CurrentUser() user: CurrentUserData) {
    return this.bankingService.listIntegrations(user.tenantId);
  }

  @Post('integrations')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  createIntegration(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateBankIntegrationDto,
  ) {
    return this.bankingService.createIntegration(user.tenantId, dto);
  }

  @Patch('integrations/:id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  updateIntegration(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateBankIntegrationDto,
  ) {
    return this.bankingService.updateIntegration(id, user.tenantId, dto);
  }

  @Delete('integrations/:id')
  deleteIntegration(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.bankingService.deleteIntegration(id, user.tenantId);
  }

  @Post('integrations/:id/health')
  healthcheckIntegration(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.bankingService.healthcheckIntegration(id, user.tenantId);
  }

  @Post('integrations/:id/sync')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  syncIntegration(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: SyncBankIntegrationDto,
  ) {
    return this.bankingService.syncIntegration(id, user.tenantId, dto);
  }

  @Get('transactions')
  listTransactions(
    @CurrentUser() user: CurrentUserData,
    @Query('integrationId') integrationId?: string,
  ) {
    return this.bankingService.listTransactions(user.tenantId, integrationId);
  }

  @Post('transactions/:id/reconcile')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  reconcileTransaction(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ReconcileBankTransactionDto,
  ) {
    return this.bankingService.reconcileTransaction(
      id,
      user.tenantId,
      dto,
      user.userId,
    );
  }

  @Get('charges')
  listCharges(@CurrentUser() user: CurrentUserData) {
    return this.bankingService.listCharges(user.tenantId);
  }

  @Post('charges')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  createCharge(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateBankChargeDto,
  ) {
    return this.bankingService.createCharge(user.tenantId, dto);
  }

  @Get('payment-requests')
  listPaymentRequests(@CurrentUser() user: CurrentUserData) {
    return this.bankingService.listPaymentRequests(user.tenantId);
  }

  @Post('payment-requests')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  createPaymentRequest(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateBankPaymentRequestDto,
  ) {
    return this.bankingService.createPaymentRequest(user.tenantId, dto, user);
  }

  @Post('integrations/:id/webhook-events')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  receiveWebhookEvent(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ReceiveBankWebhookDto,
  ) {
    return this.bankingService.receiveWebhookEvent(id, user.tenantId, dto);
  }
}
