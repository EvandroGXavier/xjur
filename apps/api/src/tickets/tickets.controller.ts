
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { TrustedDeviceService } from '../auth/trusted-device.service';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly trustedDeviceService: TrustedDeviceService,
  ) {}

  @Post()
  create(@Body() createTicketDto: CreateTicketDto, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) throw new Error('User context invalid');
    // Using user.userId as assignee by default or creator
    return this.ticketsService.create(createTicketDto, user.tenantId, user.userId);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData, @Query('status') status?: string, @Query('queue') queue?: string) {
    if (!user || !user.tenantId) throw new Error('User context invalid');
    return this.ticketsService.findAll(user.tenantId, { status, queue });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) throw new Error('User context invalid');
    return this.ticketsService.findOne(id, user.tenantId);
  }

  @Post(':id/messages')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './storage/uploads',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        return cb(null, `${randomName}${extname(file.originalname)}`);
      }
    })
  }))
  async addMessage(
    @Param('id') id: string, 
    @Body() createMessageDto: CreateMessageDto, 
    @CurrentUser() user: CurrentUserData,
    @UploadedFile() file?: Express.Multer.File,
    @Req() req?: any,
  ) {
    if (!user || !user.tenantId) throw new Error('User context invalid');
    console.log('Incoming Message Body (DEBUG):', JSON.stringify(createMessageDto));
    if (file) console.log('Incoming File (DEBUG):', file.originalname, file.mimetype);

    if (file) {
      const header = req?.headers?.['x-device-token'];
      const deviceToken = Array.isArray(header) ? header[0] : header;
      await this.trustedDeviceService.assertTrustedDevice({
        tenantId: user.tenantId,
        userId: user.userId,
        deviceToken,
      });
    }
    
    return this.ticketsService.addMessage(id, createMessageDto, user.tenantId, user.userId, file);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) throw new Error('User context invalid');
    return this.ticketsService.updateTicket(id, { status }, user.tenantId);
  }

  @Patch(':id')
  updateTicket(@Param('id') id: string, @Body() data: any, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) throw new Error('User context invalid');
    return this.ticketsService.updateTicket(id, data, user.tenantId);
  }

  // Dev only: Simulate incoming message
  @Post(':id/simulate')
  simulateIncoming(@Param('id') id: string, @Body('content') content: string, @CurrentUser() user: CurrentUserData) {
     if (!user || !user.tenantId) throw new Error('User context invalid');
     return this.ticketsService.simulateIncomingMessage(id, content, user.tenantId);
  }
  @Post(':id/read')
  async markAsRead(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) throw new Error('User context invalid');
    return this.ticketsService.markAsRead(id, user.tenantId);
  }

  @Delete('messages/:messageId')
  async deleteMessage(@Param('messageId') messageId: string, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) throw new Error('User context invalid');
    return this.ticketsService.deleteMessage(messageId, user.tenantId, user.userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) throw new Error('User context invalid');
    return this.ticketsService.remove(id, user.tenantId);
  }
}
