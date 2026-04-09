import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TagsService {
  private readonly logger = new Logger(TagsService.name);
  private readonly libraryScope = 'LIBRARY';
  private readonly internalLibraryTagName = 'SISTEMA';
  private readonly internalLibraryTagColor = '#f59e0b';
  private readonly internalLibraryTagTextColor = '#ffffff';

  constructor(private readonly prisma: PrismaService) {}

  private normalizeScopeList(input: any): string[] {
    const list = Array.isArray(input) ? input : input ? [input] : [];
    const normalized = list
      .map((s) => String(s || '').trim().toUpperCase())
      .filter(Boolean);
    return Array.from(new Set(normalized)).slice(0, 20);
  }

  private normalizeTagName(input: any): string {
    return String(input || '')
      .trim()
      .replace(/^#+/, '')
      .replace(/\s+/g, ' ')
      .slice(0, 80);
  }

  private normalizeTagKey(input: any): string {
    return this.normalizeTagName(input).toUpperCase();
  }

  private isInternalLibraryTag(tag: any): boolean {
    if (!tag) return false;
    const scopes = this.normalizeScopeList(tag.scope);
    return (
      scopes.includes(this.libraryScope) &&
      this.normalizeTagKey(tag.name) === this.internalLibraryTagName
    );
  }

  private serializeTag(tag: any) {
    return {
      ...tag,
      scope: this.normalizeScopeList(tag?.scope),
      isInternal: this.isInternalLibraryTag(tag),
    };
  }

  private async findTagByName(tenantId: string, name: string) {
    return this.prisma.tag.findFirst({
      where: {
        tenantId,
        name: { equals: name, mode: 'insensitive' },
      },
    });
  }

  private async ensureScopes(tag: any, scopeList: string[]) {
    const currentScopes = this.normalizeScopeList(tag?.scope);
    const nextScopes = Array.from(new Set([...currentScopes, ...scopeList]));
    if (
      nextScopes.length === currentScopes.length &&
      nextScopes.every((scope) => currentScopes.includes(scope)) &&
      tag.active
    ) {
      return tag;
    }

    return this.prisma.tag.update({
      where: { id: tag.id },
      data: {
        active: true,
        scope: nextScopes,
      },
    });
  }

  async findAll(tenantId: string, scope?: string) {
    try {
      const normalizedScope = String(scope || '').trim().toUpperCase();
      const tags = await this.prisma.tag.findMany({
        where: {
          tenantId,
          active: true,
        },
        orderBy: [{ name: 'asc' }],
      });

      const filtered =
        normalizedScope.length > 0
          ? tags.filter((tag) => {
              const scopes = this.normalizeScopeList((tag as any).scope);
              return scopes.includes(normalizedScope);
            })
          : tags;

      this.logger.log(
        `Found ${filtered.length} tags for tenant ${tenantId}${normalizedScope ? ` (scope=${normalizedScope})` : ''}`,
      );
      return filtered.map((tag) => this.serializeTag(tag));
    } catch (error) {
      this.logger.error(
        `Error fetching tags for tenant ${tenantId}: ${error.message}`,
      );
      this.logger.error(error.stack);
      throw error;
    }
  }

  async create(tenantId: string, data: any) {
    try {
      const name = this.normalizeTagName(data?.name);
      if (!name) {
        throw new BadRequestException('Nome da tag é obrigatório.');
      }

      const isReservedInternal =
        this.normalizeTagKey(name) === this.internalLibraryTagName;
      const scopeList = this.normalizeScopeList(data?.scope);
      const nextScopes = isReservedInternal
        ? [this.libraryScope]
        : scopeList.length
          ? scopeList
          : ['CONTACT'];
      const existing = await this.findTagByName(tenantId, name);

      if (existing) {
        const updated = this.isInternalLibraryTag(existing)
          ? await this.prisma.tag.update({
              where: { id: existing.id },
              data: {
                active: true,
                scope: [this.libraryScope],
                color: this.internalLibraryTagColor,
                textColor: this.internalLibraryTagTextColor,
              },
            })
          : await this.ensureScopes(existing, nextScopes);
        return this.serializeTag(updated);
      }

      const isInternalLibraryTag = isReservedInternal;

      this.logger.log(
        `Creating tag for tenant ${tenantId}: ${JSON.stringify({
          ...data,
          name,
          scope: nextScopes,
        })}`,
      );

      const tag = await this.prisma.tag.create({
        data: {
          name,
          color: isInternalLibraryTag
            ? this.internalLibraryTagColor
            : data.color || '#6366f1',
          textColor: isInternalLibraryTag
            ? this.internalLibraryTagTextColor
            : data.textColor || '#ffffff',
          scope: nextScopes,
          tenantId,
        },
      });

      this.logger.log(`Tag created: ${tag.id} - ${tag.name}`);
      return this.serializeTag(tag);
    } catch (error) {
      this.logger.error(
        `Error creating tag for tenant ${tenantId}: ${error.message}`,
      );
      this.logger.error(error.stack);
      throw error;
    }
  }

  async update(tenantId: string, id: string, data: any) {
    try {
      const existing = await this.prisma.tag.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        throw new NotFoundException('Tag not found');
      }

      if (this.isInternalLibraryTag(existing)) {
        throw new ForbiddenException(
          'A tag SISTEMA é interna da Biblioteca e não pode ser editada.',
        );
      }

      const next: any = { ...data };
      if (Object.prototype.hasOwnProperty.call(next, 'name')) {
        next.name = this.normalizeTagName(next.name);
        if (!next.name) {
          throw new BadRequestException('Nome da tag é obrigatório.');
        }
      }

      if (Object.prototype.hasOwnProperty.call(next, 'scope')) {
        const scopeList = this.normalizeScopeList(next.scope);
        next.scope = scopeList.length ? scopeList : ['CONTACT'];
      }

      const updated = await this.prisma.tag.update({
        where: { id },
        data: next,
      });

      return this.serializeTag(updated);
    } catch (error) {
      this.logger.error(`Error updating tag ${id}: ${error.message}`);
      throw error;
    }
  }

  async remove(tenantId: string, id: string) {
    try {
      const existing = await this.prisma.tag.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        throw new NotFoundException('Tag not found');
      }

      if (this.isInternalLibraryTag(existing)) {
        throw new ForbiddenException(
          'A tag SISTEMA é interna da Biblioteca e não pode ser excluída.',
        );
      }

      await (this.prisma as any).contactTag.deleteMany({ where: { tagId: id } });
      await (this.prisma as any).processTag.deleteMany({ where: { tagId: id } });
      await (this.prisma as any).financialRecordTag.deleteMany({
        where: { tagId: id },
      });
      await (this.prisma as any).processTimelineTag.deleteMany({
        where: { tagId: id },
      });
      await (this.prisma as any).documentTemplateTag?.deleteMany?.({
        where: { tagId: id },
      });

      const removed = await this.prisma.tag.delete({
        where: { id },
      });

      return this.serializeTag(removed);
    } catch (error) {
      this.logger.error(`Error removing tag ${id}: ${error.message}`);
      throw error;
    }
  }

  async attachToContact(contactId: string, tagId: string) {
    try {
      return await (this.prisma as any).contactTag.upsert({
        where: { tagId_contactId: { tagId, contactId } },
        create: { tagId, contactId },
        update: {},
      });
    } catch (error) {
      this.logger.error(
        `Error attaching tag ${tagId} to contact ${contactId}: ${error.message}`,
      );
      throw error;
    }
  }

  async detachFromContact(contactId: string, tagId: string) {
    try {
      return await (this.prisma as any).contactTag.delete({
        where: { tagId_contactId: { tagId, contactId } },
      });
    } catch (error) {
      this.logger.error(
        `Error detaching tag ${tagId} from contact ${contactId}: ${error.message}`,
      );
      throw error;
    }
  }

  async attachToProcess(processId: string, tagId: string) {
    try {
      return await (this.prisma as any).processTag.upsert({
        where: { tagId_processId: { tagId, processId } },
        create: { tagId, processId },
        update: {},
      });
    } catch (error) {
      this.logger.error(
        `Error attaching tag ${tagId} to process ${processId}: ${error.message}`,
      );
      throw error;
    }
  }

  async detachFromProcess(processId: string, tagId: string) {
    try {
      return await (this.prisma as any).processTag.delete({
        where: { tagId_processId: { tagId, processId } },
      });
    } catch (error) {
      this.logger.error(
        `Error detaching tag ${tagId} from process ${processId}: ${error.message}`,
      );
      throw error;
    }
  }

  async attachToFinancialRecord(financialRecordId: string, tagId: string) {
    try {
      return await (this.prisma as any).financialRecordTag.upsert({
        where: { tagId_financialRecordId: { tagId, financialRecordId } },
        create: { tagId, financialRecordId },
        update: {},
      });
    } catch (error) {
      this.logger.error(
        `Error attaching tag ${tagId} to financial record ${financialRecordId}: ${error.message}`,
      );
      throw error;
    }
  }

  async detachFromFinancialRecord(financialRecordId: string, tagId: string) {
    try {
      return await (this.prisma as any).financialRecordTag.delete({
        where: { tagId_financialRecordId: { tagId, financialRecordId } },
      });
    } catch (error) {
      this.logger.error(
        `Error detaching tag ${tagId} from financial record ${financialRecordId}: ${error.message}`,
      );
      throw error;
    }
  }

  async attachToTimeline(timelineId: string, tagId: string) {
    try {
      return await (this.prisma as any).processTimelineTag.upsert({
        where: { tagId_timelineId: { tagId, timelineId } },
        create: { tagId, timelineId },
        update: {},
      });
    } catch (error) {
      this.logger.error(
        `Error attaching tag ${tagId} to timeline ${timelineId}: ${error.message}`,
      );
      throw error;
    }
  }

  async detachFromTimeline(timelineId: string, tagId: string) {
    try {
      return await (this.prisma as any).processTimelineTag.delete({
        where: { tagId_timelineId: { tagId, timelineId } },
      });
    } catch (error) {
      this.logger.error(
        `Error detaching tag ${tagId} from timeline ${timelineId}: ${error.message}`,
      );
      throw error;
    }
  }

  async attachToTemplate(tenantId: string, templateId: string, tagId: string) {
    try {
      const [template, tag] = await Promise.all([
        this.prisma.documentTemplate.findFirst({
          where: { id: templateId },
          select: { id: true, tenantId: true, isSystemTemplate: true },
        }),
        this.prisma.tag.findFirst({
          where: { id: tagId, tenantId, active: true },
        }),
      ]);

      if (!template || template.tenantId !== tenantId || template.isSystemTemplate) {
        throw new ForbiddenException(
          'A inclusão inline de tags é permitida apenas em modelos do escritório.',
        );
      }

      if (!tag) {
        throw new NotFoundException('Tag not found');
      }

      if (this.isInternalLibraryTag(tag)) {
        throw new ForbiddenException(
          'A tag SISTEMA é interna e não pode ser vinculada manualmente.',
        );
      }

      return await (this.prisma as any).documentTemplateTag.upsert({
        where: { templateId_tagId: { tagId, templateId } },
        create: { tagId, templateId },
        update: {},
      });
    } catch (error) {
      this.logger.error(
        `Error attaching tag ${tagId} to template ${templateId}: ${error.message}`,
      );
      throw error;
    }
  }

  async detachFromTemplate(tenantId: string, templateId: string, tagId: string) {
    try {
      const [template, tag] = await Promise.all([
        this.prisma.documentTemplate.findFirst({
          where: { id: templateId },
          select: { id: true, tenantId: true, isSystemTemplate: true },
        }),
        this.prisma.tag.findFirst({
          where: { id: tagId, tenantId },
        }),
      ]);

      if (!template || template.tenantId !== tenantId || template.isSystemTemplate) {
        throw new ForbiddenException(
          'A remoção inline de tags é permitida apenas em modelos do escritório.',
        );
      }

      if (!tag) {
        throw new NotFoundException('Tag not found');
      }

      if (this.isInternalLibraryTag(tag)) {
        throw new ForbiddenException(
          'A tag SISTEMA é interna e não pode ser removida manualmente.',
        );
      }

      return await (this.prisma as any).documentTemplateTag.delete({
        where: { templateId_tagId: { tagId, templateId } },
      });
    } catch (error) {
      this.logger.error(
        `Error detaching tag ${tagId} from template ${templateId}: ${error.message}`,
      );
      throw error;
    }
  }
}
