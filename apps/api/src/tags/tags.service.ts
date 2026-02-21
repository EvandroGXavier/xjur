import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TagsService {
  private readonly logger = new Logger(TagsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, scope?: string) {
    try {
      const tags = await this.prisma.tag.findMany({
        where: {
          tenantId,
          active: true,
        },
        orderBy: { name: 'asc' },
      });
      this.logger.log(`Found ${tags.length} tags for tenant ${tenantId}`);
      return tags;
    } catch (error) {
      this.logger.error(`Error fetching tags for tenant ${tenantId}: ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }

  async create(tenantId: string, data: any) {
    try {
      this.logger.log(`Creating tag for tenant ${tenantId}: ${JSON.stringify(data)}`);
      const tag = await this.prisma.tag.create({
        data: {
          name: data.name,
          color: data.color || '#6366f1',
          textColor: data.textColor || '#ffffff',
          scope: data.scope || ['CONTACT'],
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
      return await this.prisma.tag.update({
        where: { id, tenantId },
        data,
      });
    } catch (error) {
      this.logger.error(`Error updating tag ${id}: ${error.message}`);
      throw error;
    }
  }

  async remove(tenantId: string, id: string) {
    try {
      // First remove all associations
      await (this.prisma as any).contactTag.deleteMany({ where: { tagId: id } });
      await (this.prisma as any).processTag.deleteMany({ where: { tagId: id } });
      // Then delete the tag
      return await this.prisma.tag.delete({
        where: { id, tenantId },
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
}
