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
        tenantId: createTemplateDto.tenantId,
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

  async render(id: string, contactId: string, processId?: string) {
    const template = await this.findOne(id);
    
    // Fetch Contact with all details
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      include: { 
        addresses: true,
        pfDetails: true,
        pjDetails: true
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    // Fetch Process if provided
    let process = null;
    let opposingParty = null;

    if (processId) {
      process = await this.prisma.process.findUnique({
        where: { id: processId },
        include: {
          processParties: {
            where: { isOpposing: true },
            include: {
              contact: {
                include: {
                  addresses: true,
                  pfDetails: true,
                  pjDetails: true
                }
              }
            }
          }
        }
      });

      if (process?.processParties?.length > 0) {
        opposingParty = process.processParties[0].contact;
      }
    }

    let content = template.content;

    const formatDate = (date: Date | null | undefined) => {
      if (!date) return '';
      return new Date(date).toLocaleDateString('pt-BR');
    };

    const formatAddress = (addr: any) => {
      if (!addr) return '';
      return `${addr.street}, ${addr.number}${addr.complement ? ` ${addr.complement}` : ''}, ${addr.district || ''}, ${addr.city}/${addr.state} - CEP: ${addr.zipCode}`;
    };

    const replacements: Record<string, string> = {
      // CLIENTE
      '\\[NOME_CLIENTE\\]': contact.name,
      '\\[NACIONALIDADE_CLIENTE\\]': contact.pfDetails?.nationality || '',
      '\\[ESTADO_CIVIL_CLIENTE\\]': contact.pfDetails?.civilStatus || '',
      '\\[PROFISSAO_CLIENTE\\]': contact.pfDetails?.profession || '',
      '\\[CPF_CLIENTE\\]': contact.document || contact.pfDetails?.cpf || '',
      '\\[RG_CLIENTE\\]': contact.pfDetails?.rg || '',
      '\\[EMAIL_CLIENTE\\]': contact.email || '',
      '\\[NASCIMENTO_CLIENTE\\]': formatDate(contact.pfDetails?.birthDate),
      '\\[PAI_CLIENTE\\]': contact.pfDetails?.fatherName || '',
      '\\[MAE_CLIENTE\\]': contact.pfDetails?.motherName || '',
      '\\[ENDERECO_CLIENTE\\]': formatAddress(contact.addresses[0]),
      '\\[TELEFONE_CLIENTE\\]': contact.phone || contact.whatsapp || '',

      // PROCESSO
      '\\[NUMERO_PROCESSO\\]': process?.cnj || '',
      '\\[COMARCA_PROCESSO\\]': process?.district || '',
      '\\[UF_PROCESSO\\]': '', // Process doesn't have state directly, maybe extract from district or address
      '\\[OBSERVACAO_PROCESSO\\]': process?.description || '',

      // ADVERSO
      '\\[NOME_ADVERSO\\]': opposingParty?.name || '',
      '\\[CNPJ_ADVERSO\\]': opposingParty?.pjDetails?.cnpj || opposingParty?.document || '',
      '\\[CPF_ADVERSO\\]': opposingParty?.pfDetails?.cpf || opposingParty?.document || '',
      '\\[RG_ADVERSO\\]': opposingParty?.pfDetails?.rg || opposingParty?.pjDetails?.stateRegistration || '',
      '\\[NACIONALIDADE_ADVERSO\\]': opposingParty?.pfDetails?.nationality || '',
      '\\[ESTADO_CIVIL_ADVERSO\\]': opposingParty?.pfDetails?.civilStatus || '',
      '\\[PROFISSAO_ADVERSO\\]': opposingParty?.pfDetails?.profession || '',
      '\\[EMAIL_ADVERSO\\]': opposingParty?.email || '',
      '\\[NASCIMENTO_ADVERSO\\]': formatDate(opposingParty?.pfDetails?.birthDate),
      '\\[PAI_ADVERSO\\]': opposingParty?.pfDetails?.fatherName || '',
      '\\[MAE_ADVERSO\\]': opposingParty?.pfDetails?.motherName || '',
      '\\[ENDERECO_ADVERSO\\]': formatAddress(opposingParty?.addresses[0]),
      '\\[DADOS_ADVERSO\\]': opposingParty ? `${opposingParty.name}, inscrito no CPF/CNPJ sob o nº ${opposingParty.document || ''}` : '',

      // GERAL
      '\\[DATA_ATUAL\\]': new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
    };

    for (const [key, value] of Object.entries(replacements)) {
      content = content.replace(new RegExp(key, 'g'), value);
    }

    return { content };
  }
}
