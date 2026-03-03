import { Controller, Get, Post, Put, Delete, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('purchases')
@UseGuards(JwtAuthGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post('parse-xml')
  parseXmlPreview(@Body() body: { xml: string }, @CurrentUser() user: CurrentUserData) {
    return this.purchasesService.parseXmlPreview(user.tenantId, body.xml);
  }

  @Post()
  create(@Body() body: any, @CurrentUser() user: CurrentUserData) {
    return this.purchasesService.create(user.tenantId, body);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData) {
    return this.purchasesService.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.purchasesService.findOne(user.tenantId, id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: CurrentUserData) {
    return this.purchasesService.update(user.tenantId, id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.purchasesService.remove(user.tenantId, id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.purchasesService.updateStatus(user.tenantId, id, status);
  }
}
