import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

interface CreateProcessDto {
    tenantId?: string; // Opcional se pegarmos de algum lugar, por enquanto obrigatório ou fixo
    contactId?: string;
    cnj?: string;
    category: 'JUDICIAL' | 'EXTRAJUDICIAL';
    title?: string;
    code?: string;
    description?: string;
    folder?: string;
    subject?: string;
    value?: number;
    status?: string;
    // ... outros campos crawler
    court?: string;
    courtSystem?: string;
    vars?: string;
    district?: string;
    area?: string;
    class?: string;
    distributionDate?: string | Date;
    judge?: string;
    parties?: any;
    metadata?: any;
}

@Injectable()
export class ProcessesService {
    constructor(private prisma: PrismaService) {}

    async create(data: CreateProcessDto) {
        console.log('Creating process payload:', JSON.stringify(data, null, 2));

        // Validação Mínima
        if (data.category === 'JUDICIAL' && !data.cnj) {
            throw new BadRequestException('CNJ é obrigatório para processos judiciais.');
        }
        if (data.category === 'EXTRAJUDICIAL' && !data.title) {
            throw new BadRequestException('Título é obrigatório para casos.');
        }

        // 1. Resolver Tenant
        let tenantId = data.tenantId;
        if (!tenantId) {
            const defaultTenant = await this.prisma.tenant.findFirst();
            if (!defaultTenant) {
                 const newTenant = await this.prisma.tenant.create({
                     data: {
                         name: 'Escritório Principal',
                         document: '00000000000191'
                     }
                 });
                 tenantId = newTenant.id;
            } else {
                 tenantId = defaultTenant.id;
            }
        }

        // 2. Gerar Código para Casos
        let code = data.cnj;
        if (data.category === 'EXTRAJUDICIAL') {
             const year = new Date().getFullYear();
             const count = await this.prisma.process.count({
                 where: { 
                     tenantId, 
                     category: 'EXTRAJUDICIAL',
                     createdAt: {
                         gte: new Date(`${year}-01-01`),
                         lt: new Date(`${year + 1}-01-01`)
                     }
                 }
             });
             const seq = String(count + 1).padStart(4, '0');
             code = `CASO-${year}-${seq}`;
        }

        // Date Parsing Helper
        const parseDate = (d: any) => {
            if (!d) return new Date();
            if (d instanceof Date) return d;
            if (typeof d === 'string') {
                // BR format dd/mm/yyyy support
                if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) {
                   const [day, month, year] = d.split('/');
                   return new Date(`${year}-${month}-${day}`);
                }
                return new Date(d);
            }
            return new Date();
        };

        // 3. Persistir com Upsert para evitar Duplicidade de CNJ
        
        const processData = {
            tenantId,
            contactId: data.contactId,
            cnj: data.cnj,
            category: data.category,
            title: data.title || `Processo ${data.cnj}`,
            code: code,
            description: data.description,
            folder: data.folder,
            
            court: data.court,
            courtSystem: data.courtSystem,
            vars: data.vars,
            district: data.district,
            status: data.status || 'ATIVO',
            
            area: data.area,
            subject: data.subject,
            class: data.class,
            distributionDate: parseDate(data.distributionDate),
            judge: data.judge,
            value: typeof data.value === 'string' ? parseFloat(String(data.value).replace('R$', '').trim().replace('.', '').replace(',', '.')) : data.value,
            
            parties: data.parties || [],
            metadata: data.metadata || {},
        };

        try {
            if (data.category === 'JUDICIAL' && data.cnj) {
                // Upsert usando CNJ como chave única
                const process = await this.prisma.process.upsert({
                    where: { cnj: data.cnj },
                    update: {
                        // Atualizar campos que podem mudar no crawler
                        status: processData.status,
                        value: processData.value,
                        court: processData.court,
                        district: processData.district,
                        judge: processData.judge,
                        parties: processData.parties, // Atualizar partes se mudou
                        metadata: processData.metadata,
                        // Não atualizamos título/descrição se o usuário customizou, mas aqui é importação bruta.
                        // Vamos atualizar tudo para garantir sincronia.
                        courtSystem: processData.courtSystem,
                        vars: processData.vars,
                        area: processData.area,
                        subject: processData.subject,
                        class: processData.class,
                        distributionDate: processData.distributionDate,
                    },
                    create: processData
                });
                console.log('Process upserted successfully:', process.id);
                
                // 4. Sync Parties to Contacts (Async)
                if (processData.parties && Array.isArray(processData.parties)) {
                    this.syncParties(processData.parties as any[], tenantId)
                        .catch(err => console.error('Error syncing parties:', err));
                }

                return process;
            } else {
                // Caso Extrajudicial ou sem CNJ (sem chave única confiável, cria novo)
                const process = await this.prisma.process.create({
                    data: processData
                });
                console.log('Process created successfully:', process.id);

                // 4. Sync Parties to Contacts (Async)
                if (processData.parties && Array.isArray(processData.parties)) {
                    this.syncParties(processData.parties as any[], tenantId)
                        .catch(err => console.error('Error syncing parties:', err));
                }

                return process;
            }
        } catch (error) {
            console.error('Error creating/upserting process:', error);
            throw error;
        }
    }

    private async syncParties(parties: any[], tenantId: string) {
        if (!parties || !Array.isArray(parties)) return;

        for (const party of parties) {
            const { name, document, type } = party;
            if (!name) continue;

            const cleanDoc = document ? String(document).replace(/\D/g, '') : null;
            let existingContact = null;

            if (cleanDoc) {
                if (cleanDoc.length <= 11) { // CPF
                     existingContact = await this.prisma.contact.findFirst({
                         where: { 
                             tenantId,
                             pfDetails: { cpf: cleanDoc }
                         }
                     });
                } else { // CNPJ
                     existingContact = await this.prisma.contact.findFirst({
                         where: { 
                             tenantId,
                             pjDetails: { cnpj: cleanDoc }
                         }
                     });
                }
            }

            if (!existingContact) {
                const isPJ = cleanDoc && cleanDoc.length > 11;
                const personType = isPJ ? 'PJ' : 'PF';

                try {
                    await this.prisma.contact.create({
                        data: {
                            tenantId,
                            name: name.substring(0, 100), // Safety check
                            personType,
                            category: type || 'PARTE', 
                            pfDetails: !isPJ ? {
                                create: { cpf: cleanDoc }
                            } : undefined,
                            pjDetails: isPJ ? {
                                create: { cnpj: cleanDoc, companyName: name }
                            } : undefined
                        }
                    });
                    console.log(`Created contact for party: ${name} (${type})`);
                } catch (e) {
                    console.warn(`Failed to create contact for ${name}:`, e.message);
                }
            } else {
                console.log(`Contact already exists for party: ${name}`);
            }
        }
    }
    
    async findAll(params: { tenantId?: string, search?: string }) {
        console.log('Finding processes with params:', params);
         const defaultTenant = await this.prisma.tenant.findFirst();
         const tenantId = params.tenantId || defaultTenant?.id;

         if (!tenantId) {
             console.warn('No tenant found for findAll');
             return [];
         }

         const where: any = { tenantId };
         
         if (params.search) {
             where.OR = [
                 { cnj: { contains: params.search } },
                 { title: { contains: params.search, mode: 'insensitive' } },
                 // Removed complex JSON filter for reliability for now
             ];
         }

         const results = await this.prisma.process.findMany({
             where,
             orderBy: { createdAt: 'desc' }
         });
         console.log(`Found ${results.length} processes for tenant ${tenantId}`);
         return results;
    }
}
