import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@drx/database';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createTemplateDto: CreateTemplateDto) {
    return this.prisma.documentTemplate.create({
      data: {
        title: createTemplateDto.title,
        content: createTemplateDto.content,
        categoryId: createTemplateDto.categoryId,
        // variables: createTemplateDto.variables, // Json type needs handling if explicit
      },
    });
  }

  findAll(categoryId?: string) {
    return this.prisma.documentTemplate.findMany({
      where: categoryId ? { categoryId } : {},
      include: { category: true },
      orderBy: { title: 'asc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.documentTemplate.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  update(id: string, updateTemplateDto: UpdateTemplateDto) {
    return this.prisma.documentTemplate.update({
      where: { id },
      data: updateTemplateDto,
    });
  }

  remove(id: string) {
    return this.prisma.documentTemplate.delete({
      where: { id },
    });
  }

  async render(id: string, contactId: string) {
    const template = await this.findOne(id);
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      include: { addresses: true },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    let content = template.content;

    // TODO: Move this mapping to a separate helper or config
    const replacements: Record<string, string> = {
      '\\[NOME_CLIENTE\\]': contact.name,
      '\\[DOC_CLIENTE\\]': contact.document || '',
      '\\[EMAIL_CLIENTE\\]': contact.email || '',
      '\\[TELEFONE_CLIENTE\\]': contact.phone || '',
      '\\[ENDERECO_CLIENTE\\]': contact.addresses[0] 
        ? `${contact.addresses[0].street}, ${contact.addresses[0].number}, ${contact.addresses[0].city}-${contact.addresses[0].state}`
        : '',
    };

    for (const [key, value] of Object.entries(replacements)) {
      content = content.replace(new RegExp(key, 'g'), value);
    }

    return { content };
  }
}
