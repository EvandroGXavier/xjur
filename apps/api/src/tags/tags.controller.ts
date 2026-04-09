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
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserData,
} from '../common/decorators/current-user.decorator';

@Controller('tags')
@UseGuards(JwtAuthGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('scope') scope?: string,
  ) {
    return this.tagsService.findAll(user.tenantId, scope);
  }

  @Post()
  create(@Body() data: any, @CurrentUser() user: CurrentUserData) {
    return this.tagsService.create(user.tenantId, data);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() data: any,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.tagsService.update(user.tenantId, id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.tagsService.remove(user.tenantId, id);
  }

  @Post('contact/:contactId/:tagId')
  attachToContact(
    @Param('contactId') contactId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.tagsService.attachToContact(contactId, tagId);
  }

  @Delete('contact/:contactId/:tagId')
  detachFromContact(
    @Param('contactId') contactId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.tagsService.detachFromContact(contactId, tagId);
  }

  @Post('library/:templateId/:tagId')
  attachToTemplate(
    @Param('templateId') templateId: string,
    @Param('tagId') tagId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.tagsService.attachToTemplate(user.tenantId, templateId, tagId);
  }

  @Delete('library/:templateId/:tagId')
  detachFromTemplate(
    @Param('templateId') templateId: string,
    @Param('tagId') tagId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.tagsService.detachFromTemplate(user.tenantId, templateId, tagId);
  }

  @Post('process/:processId/:tagId')
  attachToProcess(
    @Param('processId') processId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.tagsService.attachToProcess(processId, tagId);
  }

  @Delete('process/:processId/:tagId')
  detachFromProcess(
    @Param('processId') processId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.tagsService.detachFromProcess(processId, tagId);
  }

  @Post('financial/:recordId/:tagId')
  attachToFinancialRecord(
    @Param('recordId') recordId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.tagsService.attachToFinancialRecord(recordId, tagId);
  }

  @Delete('financial/:recordId/:tagId')
  detachFromFinancialRecord(
    @Param('recordId') recordId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.tagsService.detachFromFinancialRecord(recordId, tagId);
  }

  @Post('timeline/:timelineId/:tagId')
  attachToTimeline(
    @Param('timelineId') timelineId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.tagsService.attachToTimeline(timelineId, tagId);
  }

  @Delete('timeline/:timelineId/:tagId')
  detachFromTimeline(
    @Param('timelineId') timelineId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.tagsService.detachFromTimeline(timelineId, tagId);
  }
}
