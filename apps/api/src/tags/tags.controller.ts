import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { TagsService } from './tags.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('tags')
@UseGuards(JwtAuthGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  async findAll(@CurrentUser() user: CurrentUserData, @Query('scope') scope?: string) {
    console.log(`[TAGS] Buscando tags para tenant: ${user.tenantId}, escopo: ${scope}`);
    const tags = await this.tagsService.findAll(user.tenantId, scope);
    console.log(`[TAGS] Encontradas ${tags.length} tags`);
    return tags;
  }

  @Post()
  create(@Body() data: any, @CurrentUser() user: CurrentUserData) {
    return this.tagsService.create(user.tenantId, data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any, @CurrentUser() user: CurrentUserData) {
    return this.tagsService.update(user.tenantId, id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.tagsService.remove(user.tenantId, id);
  }

  // Vinculação em Contatos
  @Post('contact/:contactId/:tagId')
  attachToContact(@Param('contactId') contactId: string, @Param('tagId') tagId: string) {
    return this.tagsService.attachToContact(contactId, tagId);
  }

  @Delete('contact/:contactId/:tagId')
  detachFromContact(@Param('contactId') contactId: string, @Param('tagId') tagId: string) {
    return this.tagsService.detachFromContact(contactId, tagId);
  }

  // Vinculação em Processos
  @Post('process/:processId/:tagId')
  attachToProcess(@Param('processId') processId: string, @Param('tagId') tagId: string) {
    return this.tagsService.attachToProcess(processId, tagId);
  }

  @Delete('process/:processId/:tagId')
  detachFromProcess(@Param('processId') processId: string, @Param('tagId') tagId: string) {
    return this.tagsService.detachFromProcess(processId, tagId);
  }
}
