import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createDto: any, @Request() req) {
    return this.usersService.create(createDto, req.user.tenantId);
  }

  @Get()
  findAll(@Request() req, @Query('search') search?: string) {
    return this.usersService.findAll(req.user.tenantId, search);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: any, @Request() req) {
    return this.usersService.update(id, updateDto, req.user.tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.usersService.remove(id, req.user.tenantId);
  }
}
