import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { InboxService } from './inbox.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { CreateInboxMessageDto } from './dto/create-inbox-message.dto';
import { LinkMessageProcessDto } from './dto/link-message-process.dto';
import { TrustedDeviceService } from '../auth/trusted-device.service';

@Controller('inbox')
@UseGuards(JwtAuthGuard)
export class InboxController {
  private readonly logger = new Logger(InboxController.name);

  constructor(
    private readonly inboxService: InboxService,
    private readonly trustedDeviceService: TrustedDeviceService,
  ) {}

  @Get('conversations')
  findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('search') search?: string,
  ) {
    return this.inboxService.findAllConversations(user.tenantId, {
      status,
      channel,
      search,
    });
  }

  @Post('conversations')
  create(@Body() dto: CreateConversationDto, @CurrentUser() user: CurrentUserData) {
    return this.inboxService.createConversation(user.tenantId, user.userId, dto);
  }

  @Get('conversations/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.inboxService.findConversation(id, user.tenantId);
  }

  @Patch('conversations/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.inboxService.updateConversation(id, user.tenantId, user.userId, dto);
  }

  @Delete('conversations/:id')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.inboxService.deleteConversation(id, user.tenantId);
  }

  @Post('conversations/:id/messages/text')
  sendTextMessage(
    @Param('id') id: string,
    @Body() dto: CreateInboxMessageDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    this.logger.log(
      `Inbox text send request conversation=${id} user=${user.userId} contentType=${req.headers['content-type'] || 'unknown'} dtoKeys=${
        Object.keys(dto || {}).join(',') || 'none'
      } contentLength=${(dto?.content || '').length}`,
    );
    return this.inboxService.sendMessage(id, user.tenantId, user.userId, dto);
  }

  @Post('conversations/:id/messages')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './storage/uploads',
        filename: (_req, file, callback) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          callback(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: CreateInboxMessageDto,
    @CurrentUser() user: CurrentUserData,
    @UploadedFile() file?: Express.Multer.File,
    @Req() req?: Request,
  ) {
    this.logger.log(
      `Inbox multipart send request conversation=${id} user=${user.userId} contentType=${req?.headers['content-type'] || 'unknown'} dtoKeys=${
        Object.keys(dto || {}).join(',') || 'none'
      } contentLength=${(dto?.content || '').length} hasFile=${Boolean(file)}`,
    );
    if (file) {
      const header: any = req?.headers?.['x-device-token'];
      const deviceToken = Array.isArray(header) ? header[0] : header;
      await this.trustedDeviceService.assertTrustedDevice({
        tenantId: user.tenantId,
        userId: user.userId,
        deviceToken,
      });
    }

    return this.inboxService.sendMessage(id, user.tenantId, user.userId, dto, file);
  }

  @Post('conversations/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.inboxService.markConversationRead(id, user.tenantId);
  }

  @Post('conversations/:id/simulate')
  simulateIncoming(
    @Param('id') id: string,
    @Body('content') content: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.inboxService.simulateIncomingMessage(id, user.tenantId, content);
  }

  @Post('messages/:id/link-process')
  linkToProcess(
    @Param('id') id: string,
    @Body() dto: LinkMessageProcessDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.inboxService.linkMessageToProcess(id, user.tenantId, user.userId, dto);
  }
}
