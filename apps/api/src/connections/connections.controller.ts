
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('connections')
@UseGuards(JwtAuthGuard)
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  @Post()
  create(@Body() createConnectionDto: CreateConnectionDto, @CurrentUser() user: CurrentUserData) {
    return this.connectionsService.create(createConnectionDto, user.tenantId);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData) {
    return this.connectionsService.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.connectionsService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateConnectionDto: UpdateConnectionDto, @CurrentUser() user: CurrentUserData) {
    return this.connectionsService.update(id, updateConnectionDto, user.tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.connectionsService.remove(id, user.tenantId);
  }

  @Post(':id/connect')
  connect(@Param('id') id: string, @Body() config: any, @CurrentUser() user: CurrentUserData) {
    // If config supplied, update before connecting
    if (config && Object.keys(config).length > 0) {
      this.connectionsService.update(id, { config } as any, user.tenantId);
    }
    return this.connectionsService.connect(id, user.tenantId);
  }

  @Post(':id/disconnect')
  disconnect(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.connectionsService.disconnect(id, user.tenantId);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.connectionsService.getStatus(id, user.tenantId);
  }
}
