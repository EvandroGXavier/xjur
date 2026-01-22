import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dr-x/database';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createDocumentDto: CreateDocumentDto) {
    return this.prisma.documentHistory.create({
      data: {
        title: createDocumentDto.title,
        content: createDocumentDto.content,
        templateId: createDocumentDto.templateId,
        snapshot: createDocumentDto.snapshot,
        status: createDocumentDto.status,
      },
    });
  }

  findAll() {
    return this.prisma.documentHistory.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { template: true },
    });
  }

  async findOne(id: string) {
    const document = await this.prisma.documentHistory.findUnique({
      where: { id },
    });
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }

  update(id: string, updateDocumentDto: UpdateDocumentDto) {
    return this.prisma.documentHistory.update({
      where: { id },
      data: updateDocumentDto,
    });
  }

  remove(id: string) {
    return this.prisma.documentHistory.delete({
      where: { id },
    });
  }

  // Settings Management
  async getSettings() {
    return this.prisma.documentSettings.findMany();
  }

  async updateSetting(key: string, value: string) {
    return this.prisma.documentSettings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
