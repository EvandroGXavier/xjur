import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDocumentDto: CreateDocumentDto, tenantId: string) {
    return this.prisma.documentHistory.create({
      data: {
        title: createDocumentDto.title,
        content: createDocumentDto.content,
        templateId: createDocumentDto.templateId,
        tenantId, // Use trusted tenantId
        snapshot: createDocumentDto.snapshot,
        status: createDocumentDto.status || 'DRAFT',
      },
    });
  }

  findAll(tenantId: string) {
    return this.prisma.documentHistory.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      include: { template: true },
    });
  }

  async findOne(id: string, tenantId: string) {
    const document = await this.prisma.documentHistory.findFirst({
      where: { id, tenantId },
    });
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }

  async update(id: string, updateDocumentDto: UpdateDocumentDto, tenantId: string) {
    await this.findOne(id, tenantId); // Validate existence and access
    return this.prisma.documentHistory.update({
      where: { id },
      data: updateDocumentDto,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId); // Validate access
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

  // --- TEMPLATES / BIBLIOTECA ---

  async createTemplate(dto: CreateTemplateDto, tenantId: string) {
    return this.prisma.documentTemplate.create({
      data: {
        title: dto.title,
        content: dto.content,
        categoryId: dto.categoryId,
        tenantId
      }
    });
  }

  async findAllTemplates(tenantId: string) {
    return this.prisma.documentTemplate.findMany({
      where: { tenantId },
      orderBy: { title: 'asc' }
    });
  }

  async findTemplate(id: string, tenantId: string) {
      const template = await this.prisma.documentTemplate.findFirst({
          where: { id, tenantId }
      });
      if (!template) throw new NotFoundException('Template not found');
      return template;
  }

  async updateTemplate(id: string, dto: CreateTemplateDto, tenantId: string) {
      await this.findTemplate(id, tenantId);
      return this.prisma.documentTemplate.update({
          where: { id },
          data: {
              title: dto.title,
              content: dto.content,
              categoryId: dto.categoryId
          }
      });
  }

  async deleteTemplate(id: string, tenantId: string) {
      await this.findTemplate(id, tenantId);
      return this.prisma.documentTemplate.delete({ where: { id } });
  }

  getVariables() {
      // Variables available for document generation
      return {
          contact: [
              { key: 'contact.name', label: 'Nome Completo' },
              { key: 'contact.cpf', label: 'CPF / CNPJ' },
              { key: 'contact.email', label: 'E-mail' },
              { key: 'contact.phone', label: 'Telefone' },
              { key: 'contact.address', label: 'Endereço Completo' },
          ],
          process: [
              { key: 'process.title', label: 'Nome do Processo' },
              { key: 'process.number', label: 'Número do Processo (CNJ)' },
              { key: 'process.court', label: 'Tribunal / Foro' },
              { key: 'process.value', label: 'Valor da Causa' },
              { key: 'process.judge', label: 'Juiz(a)' },
          ],
          financial: [
              { key: 'financial.totalFees', label: 'Valor Honorários' },
              { key: 'financial.installmentCount', label: 'Qtd. Parcelas' },
              { key: 'financial.dueDate', label: 'Data Vencimento' },
          ],
          system: [
              { key: 'today.date', label: 'Data de Hoje' },
              { key: 'today.fullDate', label: 'Data Extenso' },
              { key: 'user.name', label: 'Advogado Responsável' },
          ]
      };
  }
}
