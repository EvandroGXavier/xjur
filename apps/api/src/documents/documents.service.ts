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
    const templates = await this.prisma.documentTemplate.findMany({
      where: { tenantId },
      orderBy: { title: 'asc' }
    });

    if (templates.length === 0) {
        await this.seedDefaults(tenantId);
        return this.prisma.documentTemplate.findMany({
            where: { tenantId },
            orderBy: { title: 'asc' }
        });
    }

    return templates;
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

  async renderTemplate(id: string, tenantId: string, contactId: string, processId?: string) {
    const template = await this.findTemplate(id, tenantId);
    
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
      'NOME_CLIENTE': contact.name,
      'NACIONALIDADE_CLIENTE': contact.pfDetails?.nationality || '',
      'ESTADO_CIVIL_CLIENTE': contact.pfDetails?.civilStatus || '',
      'PROFISSAO_CLIENTE': contact.pfDetails?.profession || '',
      'CPF_CLIENTE': contact.document || contact.pfDetails?.cpf || '',
      'RG_CLIENTE': contact.pfDetails?.rg || '',
      'EMAIL_CLIENTE': contact.email || '',
      'NASCIMENTO_CLIENTE': formatDate(contact.pfDetails?.birthDate),
      'PAI_CLIENTE': contact.pfDetails?.fatherName || '',
      'MAE_CLIENTE': contact.pfDetails?.motherName || '',
      'ENDERECO_CLIENTE': formatAddress(contact.addresses[0]),
      'CLIENTE_ENDERECO': formatAddress(contact.addresses[0]),
      'TELEFONE_CLIENTE': contact.phone || contact.whatsapp || '',

      // PROCESSO
      'NUMERO_PROCESSO': process?.cnj || '',
      'COMARCA_PROCESSO': process?.district || '',
      'VARA_PROCESSO': process?.vars || '',
      'TRIBUNAL_PROCESSO': process?.court || '',
      'UF_PROCESSO': 'MG',
      'OBSERVACAO_PROCESSO': process?.description || '',

      // ADVERSO
      'NOME_ADVERSO': opposingParty?.name || '',
      'CNPJ_ADVERSO': opposingParty?.pjDetails?.cnpj || opposingParty?.document || '',
      'CPF_ADVERSO': opposingParty?.pfDetails?.cpf || opposingParty?.document || '',
      'RG_ADVERSO': opposingParty?.pfDetails?.rg || opposingParty?.pjDetails?.stateRegistration || '',
      'NACIONALIDADE_ADVERSO': opposingParty?.pfDetails?.nationality || '',
      'ESTADO_CIVIL_ADVERSO': opposingParty?.pfDetails?.civilStatus || '',
      'PROFISSAO_ADVERSO': opposingParty?.pfDetails?.profession || '',
      'EMAIL_ADVERSO': opposingParty?.email || '',
      'NASCIMENTO_ADVERSO': formatDate(opposingParty?.pfDetails?.birthDate),
      'PAI_ADVERSO': opposingParty?.pfDetails?.fatherName || '',
      'MAE_ADVERSO': opposingParty?.pfDetails?.motherName || '',
      'ADVERSO_ENDERECO': formatAddress(opposingParty?.addresses[0]),
      'DADOS_ADVERSO': opposingParty ? `${opposingParty.name}, inscrito no CPF/CNPJ sob o nº ${opposingParty.document || ''}` : '',

      // GERAL
      'DATA_ATUAL': new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
      
      // ALIASES (Compatibilidade com modelos manuais)
      'dados_vara': process?.vars || '',
      'numero_processo': process?.cnj || '',
      'nome_cliente': contact.name,
    };

    for (const [key, value] of Object.entries(replacements)) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      content = content.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'gi'), value);
      content = content.replace(new RegExp(`\\[${escapedKey}\\]`, 'gi'), value);
    }

    return { content };
  }

  getVariables() {
      // Variables available for document generation
      return {
          contact: [
              // Basic Info
              { key: 'contact.name', label: 'Nome Completo' },
              { key: 'contact.personType', label: 'Tipo (PF/PJ)' },
              { key: 'contact.document', label: 'CPF / CNPJ (Genérico)' },
              { key: 'contact.whatsapp', label: 'WhatsApp' },
              { key: 'contact.email', label: 'E-mail' },
              { key: 'contact.phone', label: 'Telefone' },
              { key: 'contact.notes', label: 'Observações' },
              { key: 'contact.category', label: 'Categoria' },
              
              // Address (Primary)
              { key: 'contact.address.street', label: 'Logradouro' },
              { key: 'contact.address.number', label: 'Número' },
              { key: 'contact.address.city', label: 'Cidade' },
              { key: 'contact.address.state', label: 'Estado' },
              { key: 'contact.address.zipCode', label: 'CEP' },

              // Pessoa Física (PF)
              { key: 'contact.pf.cpf', label: 'CPF' },
              { key: 'contact.pf.rg', label: 'RG' },
              { key: 'contact.pf.rgIssuer', label: 'Órgão Emissor RG' },
              { key: 'contact.pf.rgIssueDate', label: 'Data Emissão RG' },
              { key: 'contact.pf.birthDate', label: 'Data Nascimento' },
              { key: 'contact.pf.nis', label: 'NIS' },
              { key: 'contact.pf.pis', label: 'PIS' },
              { key: 'contact.pf.ctps', label: 'CTPS' },
              { key: 'contact.pf.motherName', label: 'Nome da Mãe' },
              { key: 'contact.pf.fatherName', label: 'Nome do Pai' },
              { key: 'contact.pf.profession', label: 'Profissão' },
              { key: 'contact.pf.nationality', label: 'Nacionalidade' },
              { key: 'contact.pf.naturality', label: 'Naturalidade' },
              { key: 'contact.pf.gender', label: 'Gênero' },
              { key: 'contact.pf.civilStatus', label: 'Estado Civil' },
              { key: 'contact.pf.cnh', label: 'CNH' },
              { key: 'contact.pf.cnhCategory', label: 'Categoria CNH' },
              { key: 'contact.pf.fullName', label: 'Nome Completo (Legal)' },

              // Pessoa Jurídica (PJ)
              { key: 'contact.pj.cnpj', label: 'CNPJ' },
              { key: 'contact.pj.companyName', label: 'Razão Social' },
              { key: 'contact.pj.stateRegistration', label: 'Inscrição Estadual' },
              { key: 'contact.pj.openingDate', label: 'Data Abertura' },
              { key: 'contact.pj.legalNature', label: 'Natureza Jurídica' },
          ],
          process: [
              // Basic Info
              { key: 'process.title', label: 'Título do Caso' },
              { key: 'process.number', label: 'Número do Processo (CNJ)' },
              { key: 'process.npu', label: 'Numeração Única (NPU)' },
              { key: 'process.category', label: 'Categoria' },
              { key: 'process.code', label: 'Código Interno' },
              { key: 'process.folder', label: 'Pasta na Nuvem' },
              
              // Court Info
              { key: 'process.court', label: 'Tribunal' },
              { key: 'process.courtSystem', label: 'Sistema (PJe/Eproc)' },
              { key: 'process.vars', label: 'Vara' },
              { key: 'process.district', label: 'Comarca' },
              { key: 'process.status', label: 'Status' },
              
              // Classification
              { key: 'process.area', label: 'Área' },
              { key: 'process.subject', label: 'Assunto' },
              { key: 'process.class', label: 'Classe' },
              { key: 'process.distributionDate', label: 'Data Distribuição' },
              { key: 'process.judge', label: 'Magistrado' },
              { key: 'process.value', label: 'Valor da Causa' },
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
              { key: 'user.oab', label: 'OAB do Advogado' },
              { key: 'current.city', label: 'Cidade do Escritório' },
              { key: 'current.state', label: 'Estado do Escritório' },
          ]
      };
  }

  async seedDefaults(tenantId: string) {
      // 1. Create Default Categories
      const procuracaoCat = await this.prisma.documentCategory.upsert({
          where: { id: 'default-procuracao-' + tenantId }, // Mock ID strategy or use findFirst
          update: {},
          create: {
             name: 'Procurações',
             tenantId
          }
      }).catch(async () => {
          // Fallback if ID strategy doesn't work with UUIDs, rely on name finding
          const existing = await this.prisma.documentCategory.findFirst({
             where: { tenantId, name: 'Procurações' }
          });
          if (existing) return existing;
          return this.prisma.documentCategory.create({
             data: { name: 'Procurações', tenantId }
          });
      });

      // 2. Create Procuração Template
      const templateTitle = 'Procuração Geral e Previdenciária';
      const existingTemplate = await this.prisma.documentTemplate.findFirst({
          where: { tenantId, title: templateTitle }
      });

      if (!existingTemplate) {
          const content = `
<h1 style="text-align: center; text-decoration: underline; font-weight: bold; margin-bottom: 30px;">PROCURAÇÃO</h1>

<table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 20px;">
    <tr>
        <td style="width: 150px; border-right: 1px solid #000; padding: 10px; vertical-align: middle; font-weight: bold;">OUTORGANTE</td>
        <td style="padding: 10px;">
            <strong>{{contact.name}}</strong>, {{contact.pf.nationality}}, {{contact.pf.civilStatus}}, {{contact.pf.profession}}, 
            inscrito no CPF sob o nº {{contact.pf.cpf}}, RG {{contact.pf.rg}} {{contact.pf.rgIssuer}}, 
            residente e domiciliado à {{contact.address.street}}, {{contact.address.number}}, {{contact.address.city}}, {{contact.address.state}}, CEP {{contact.address.zipCode}}. 
            Email: {{contact.email}}. Filiação: {{contact.pf.motherName}} e {{contact.pf.fatherName}}.
        </td>
    </tr>
</table>

<table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 20px;">
    <tr>
        <td style="width: 150px; border-right: 1px solid #000; padding: 10px; vertical-align: middle; font-weight: bold;">OUTORGADOS:</td>
        <td style="padding: 10px;">
            <strong>{{user.name}}</strong>, advogado, inscrito na OAB sob o nº {{user.oab}}, 
            com escritório profissional em {{current.city}}/{{current.state}}.
        </td>
    </tr>
</table>

<p style="text-align: justify; margin-bottom: 15px;">
    <strong>PODERES:</strong> O(s) outorgante(s) nomeia(m) os outorgados seus procuradores, conferindo-lhes os poderes da cláusula "ad judicia" e "ad extra", conjunta ou separadamente, para representá-lo(s) em juízo ou fora dele, outorgando-lhes ainda os especiais poderes para receber citação, de concordar, acordar, confessar, discordar, desistir, transigir, firmar compromissos, reconhecer a procedência do pedido, renunciar ao direito sobre o qual se funda a ação, receber, dar quitação, executar e fazer cumprir decisões e títulos judiciais e extrajudiciais, receber valores e levantar alvarás judiciais extraídos em nome do outorgante, requerer falências e concordatas, imputar a terceiros, em nome dos outorgantes, fatos descritos como crimes, arguir exceções de suspeição, firmar compromisso e declarar hipossuficiência econômica, constituir preposto, substabelecer com ou sem reserva os poderes conferidos pelo presente mandato. Declara ainda, que tem ciência que o levantamento de créditos decorrentes de precatório ou RPV somente poderá ser efetivado mediante alvará judicial.
</p>

<p style="text-align: justify; margin-bottom: 15px;">
    INCLUSIVE: AO INSTITUTO NACIONAL DO SEGURO SOCIAL.
</p>

<p style="text-align: justify; margin-bottom: 40px;">
    O outorgante nomeia e constitui o(a) outorgado(a) seu bastante procurador a quem confere poderes especiais para representá-lo perante o INSS, bem como usar de todos os meios legais para o fiel cumprimento do presente mandato com os fins específicos para cadastro de senhas para informações previdenciárias pela internet, comprovação de vida junto à rede bancária, receber mensalidades de benefícios, receber quantias atrasadas e firmar os respectivos recibos, devido possível incapacidade do outorgante em se locomover ou, se for o caso, em portar de moléstia contagiosa, também para o caso de ausência devida à viagem dentro do país pelo período a declarar, assim como por ausência devido à viagem ao exterior pelo período a e eventualmente por residir no exterior o qual informará o país, requerer benefícios, revisão e interpor recursos.
</p>

<p style="text-align: center; margin-bottom: 60px;">
    {{current.city}}, {{today.fullDate}}.
</p>

<div style="text-align: center; border-top: 1px solid #000; width: 60%; margin: 0 auto; padding-top: 10px;">
    <strong>{{contact.name}}</strong><br>
    Outorgante
</div>
`;
          await this.prisma.documentTemplate.create({
              data: {
                  title: templateTitle,
                  content: content,
                  categoryId: procuracaoCat.id,
                  tenantId
              }
          });
          return { message: 'Template de Procuração criado com sucesso.' };
      }
      return { message: 'Template já existente.' };
  }
}
