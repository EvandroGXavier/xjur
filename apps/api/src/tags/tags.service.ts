import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, scope?: string) {
    return this.prisma.tag.findMany({
      where: {
        tenantId,
        active: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(tenantId: string, data: any) {
    return this.prisma.tag.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    return this.prisma.tag.update({
      where: { id, tenantId },
      data,
    });
  }

  async remove(tenantId: string, id: string) {
    return this.prisma.tag.delete({
      where: { id, tenantId },
    });
  }

  async attachToContact(contactId: string, tagId: string) {
    return (this.prisma as any).contactTag.upsert({
      where: { tagId_contactId: { tagId, contactId } },
      create: { tagId, contactId },
      update: {},
    });
  }

  async detachFromContact(contactId: string, tagId: string) {
    return (this.prisma as any).contactTag.delete({
      where: { tagId_contactId: { tagId, contactId } },
    });
  }

  async attachToProcess(processId: string, tagId: string) {
    return (this.prisma as any).processTag.upsert({
      where: { tagId_processId: { tagId, processId } },
      create: { tagId, processId },
      update: {},
    });
  }

  async detachFromProcess(processId: string, tagId: string) {
    return (this.prisma as any).processTag.delete({
      where: { tagId_processId: { tagId, processId } },
    });
  }
}
