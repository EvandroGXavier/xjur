import { Controller, Get, Post, Body, Param, Patch, Put, Delete, UseGuards } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('proposals')
@UseGuards(JwtAuthGuard)
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Post()
  create(@Body() body: any, @CurrentUser() user: CurrentUserData) {
    return this.proposalsService.create(user.tenantId, body);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData) {
    return this.proposalsService.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.proposalsService.findOne(user.tenantId, id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: CurrentUserData) {
    return this.proposalsService.update(user.tenantId, id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.proposalsService.remove(user.tenantId, id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.proposalsService.updateStatus(user.tenantId, id, status);
  }

  @Post(':id/bill')
  bill(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.proposalsService.bill(user.tenantId, id, body);
  }
}
