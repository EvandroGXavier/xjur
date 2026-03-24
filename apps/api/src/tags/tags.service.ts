import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TagsService {
  private readonly logger = new Logger(TagsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private normalizeScopeList(input: any): string[] {
    const list = Array.isArray(input) ? input : input ? [input] : [];
    const normalized = list
      .map((s) => String(s || '').trim().toUpperCase())
      .filter(Boolean);
    return Array.from(new Set(normalized)).slice(0, 20);
  }

  async findAll(tenantId: string, scope?: string) {
    try {
      const normalizedScope = String(scope || '').trim().toUpperCase();
      const tags = await this.prisma.tag.findMany({
        where: {
          tenantId,
          active: true,
        },
        orderBy: { name: 'asc' },
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
      return filtered;
    } catch (error) {
      this.logger.error(`Error fetching tags for tenant ${tenantId}: ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }

  async create(tenantId: string, data: any) {
    try {
      const scopeList = this.normalizeScopeList(data?.scope);
      this.logger.log(`Creating tag for tenant ${tenantId}: ${JSON.stringify(data)}`);
      const tag = await this.prisma.tag.create({
        data: {
          name: data.name,
          color: data.color || '#6366f1',
          textColor: data.textColor || '#ffffff',
          scope: scopeList.length ? scopeList : ['CONTACT'],
          tenantId,
        },
      });
      this.logger.log(`Tag created: ${tag.id} - ${tag.name}`);
      return tag;
    } catch (error) {
      this.logger.error(`Error creating tag for tenant ${tenantId}: ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }

  async update(tenantId: string, id: string, data: any) {
    try {
      const next: any = { ...data };
      if (Object.prototype.hasOwnProperty.call(next, 'scope')) {
        const scopeList = this.normalizeScopeList(next.scope);
        next.scope = scopeList.length ? scopeList : ['CONTACT'];
      }

      const existing = await this.prisma.tag.findFirst({ where: { id, tenantId } });
      if (!existing) {
        throw new NotFoundException('Tag not found');
      }
      return await this.prisma.tag.update({
        where: { id },
        data: next,
      });
    } catch (error) {
      this.logger.error(`Error updating tag ${id}: ${error.message}`);
      throw error;
    }
  }

  async remove(tenantId: string, id: string) {
    try {
      const existing = await this.prisma.tag.findFirst({ where: { id, tenantId } });
      if (!existing) {
        throw new NotFoundException('Tag not found');
      }
      // First remove all associations
      await (this.prisma as any).contactTag.deleteMany({ where: { tagId: id } });
      await (this.prisma as any).processTag.deleteMany({ where: { tagId: id } });
      await (this.prisma as any).financialRecordTag.deleteMany({ where: { tagId: id } });
      await (this.prisma as any).processTimelineTag.deleteMany({ where: { tagId: id } });
      await (this.prisma as any).documentTemplateTag?.deleteMany?.({ where: { tagId: id } });
      // Then delete the tag
      return await this.prisma.tag.delete({
        where: { id },
      });
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
      this.logger.error(`Error attaching tag ${tagId} to contact ${contactId}: ${error.message}`);
      throw error;
    }
  }

  async detachFromContact(contactId: string, tagId: string) {
    try {
      return await (this.prisma as any).contactTag.delete({
        where: { tagId_contactId: { tagId, contactId } },
      });
    } catch (error) {
      this.logger.error(`Error detaching tag ${tagId} from contact ${contactId}: ${error.message}`);
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
      this.logger.error(`Error attaching tag ${tagId} to process ${processId}: ${error.message}`);
      throw error;
    }
  }

  async detachFromProcess(processId: string, tagId: string) {
    try {
      return await (this.prisma as any).processTag.delete({
        where: { tagId_processId: { tagId, processId } },
      });
    } catch (error) {
      this.logger.error(`Error detaching tag ${tagId} from process ${processId}: ${error.message}`);
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
      this.logger.error(`Error attaching tag ${tagId} to financial record ${financialRecordId}: ${error.message}`);
      throw error;
    }
  }

  async detachFromFinancialRecord(financialRecordId: string, tagId: string) {
    try {
      return await (this.prisma as any).financialRecordTag.delete({
        where: { tagId_financialRecordId: { tagId, financialRecordId } },
      });
    } catch (error) {
      this.logger.error(`Error detaching tag ${tagId} from financial record ${financialRecordId}: ${error.message}`);
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
      this.logger.error(`Error attaching tag ${tagId} to timeline ${timelineId}: ${error.message}`);
      throw error;
    }
  }

  async detachFromTimeline(timelineId: string, tagId: string) {
    try {
      return await (this.prisma as any).processTimelineTag.delete({
        where: { tagId_timelineId: { tagId, timelineId } },
      });
    } catch (error) {
      this.logger.error(`Error detaching tag ${tagId} from timeline ${timelineId}: ${error.message}`);
      throw error;
    }
  }
}
