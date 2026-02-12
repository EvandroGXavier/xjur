
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  create(@Body() createAppointmentDto: CreateAppointmentDto, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) {
        throw new Error('User context invalid');
    }
    return this.appointmentsService.create(createAppointmentDto, user.tenantId);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData, @Query('start') start?: string, @Query('end') end?: string) {
    if (!user || !user.tenantId) {
        throw new Error('User context invalid');
    }
    return this.appointmentsService.findAll(user.tenantId, start, end);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) {
        throw new Error('User context invalid');
    }
    return this.appointmentsService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAppointmentDto: UpdateAppointmentDto, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) {
        throw new Error('User context invalid');
    }
    return this.appointmentsService.update(id, updateAppointmentDto, user.tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) {
        throw new Error('User context invalid');
    }
    return this.appointmentsService.remove(id, user.tenantId);
  }
}
