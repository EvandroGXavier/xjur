
import { Controller, Post, Body } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { IncomingCommunicationDto } from './dto/incoming-communication.dto';

@Controller('communications')
export class CommunicationsController {
  constructor(private readonly service: CommunicationsService) {}

  @Post('webhook')
  async handleWebhook(@Body() dto: IncomingCommunicationDto) {
    // In production, validate API Key here
    return this.service.processIncoming(dto);
  }
}
