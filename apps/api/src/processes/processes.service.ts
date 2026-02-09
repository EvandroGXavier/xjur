import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as fs from 'fs';
import * as path from 'path';

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

    private logAudit(step: string, data: any) {
        try {
            const logDir = path.join(process.cwd(), 'tmp', 'audit_logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `process_${step}_${timestamp}.json`;
            fs.writeFileSync(path.join(logDir, filename), JSON.stringify(data, null, 2));
            console.log(`[AUDIT] Log saved: ${filename}`);
        } catch (e) {
            console.error('[AUDIT] Failed to save log:', e);
        }
    }

    async create(data: CreateProcessDto) {
        this.logAudit('1_RECEIVED_PAYLOAD', data);
        console.log('Creating process payload:', JSON.stringify(data, null, 2));

        // Validação Mínima
        // ... (código existente de validação e tenant)
        // ... (repetir lógica de tenant e code do código anterior, mantendo consistência)
        
        // RECUPERANDO trechos anteriores para contexto (simplificado para replace)
        if (data.category === 'JUDICIAL' && !data.cnj) {
             throw new BadRequestException('CNJ é obrigatório para processos judiciais.');
        }
        if (data.category === 'EXTRAJUDICIAL' && !data.title) {
             throw new BadRequestException('Título é obrigatório para casos.');
        }

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

        const parseDate = (d: any) => {
            if (!d) return new Date();
            if (d instanceof Date) return d;
            if (typeof d === 'string') {
                if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) {
                   const [day, month, year] = d.split('/');
                   return new Date(`${year}-${month}-${day}`);
                }
                return new Date(d);
            }
            return new Date();
        };

        // PREPARE DATA
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

        this.logAudit('2_MAPPED_DATA', processData);

        try {
            if (data.category === 'JUDICIAL' && data.cnj) {
                // Upsert usando CNJ como chave única
                const process = await this.prisma.process.upsert({
                    where: { cnj: data.cnj },
                    update: {
                        status: processData.status,
                        value: processData.value,
                        court: processData.court,
                        district: processData.district,
                        judge: processData.judge,
                        parties: processData.parties, 
                        metadata: processData.metadata,
                        courtSystem: processData.courtSystem,
                        vars: processData.vars,
                        area: processData.area,
                        subject: processData.subject,
                        class: processData.class,
                        distributionDate: processData.distributionDate,
                    },
                    create: processData
                });
                
                this.logAudit('3_SAVED_RESULT_UPSERT', process);
                console.log('Process upserted successfully:', process.id);
                
                // 4. Sync Parties
                if (processData.parties && Array.isArray(processData.parties)) {
                    this.syncParties(processData.parties as any[], tenantId, processData.judge)
                        .catch(err => console.error('Error syncing parties:', err));
                }

                return process;
            } else {
                const process = await this.prisma.process.create({
                    data: processData
                });
                
                this.logAudit('3_SAVED_RESULT_CREATE', process);
                console.log('Process created successfully:', process.id);

                // 4. Sync Parties
                if (processData.parties && Array.isArray(processData.parties)) {
                    this.syncParties(processData.parties as any[], tenantId, processData.judge)
                        .catch(err => console.error('Error syncing parties:', err));
                }

                return process;
            }
        } catch (error) {
            this.logAudit('ERROR_SAVING', { error: error.message, stack: error.stack });
            console.error('Error creating/upserting process:', error);
            throw error;
        }
    }

    private normalizePartyType(rawType: string): string {
        const type = rawType ? rawType.toUpperCase() : '';
        if (['AUTOR', 'REQUERENTE', 'EXEQUENTE', 'IMPETRANTE', 'RECLAMANTE'].some(t => type.includes(t))) return 'ENVOLVIDO (POLO ATIVO)';
        if (['RÉU', 'REU', 'REQUERIDO', 'EXECUTADO', 'IMPETRADO', 'RECLAMADO'].some(t => type.includes(t))) return 'ENVOLVIDO (POLO PASSIVO)';
        if (['ADVOGADO', 'PROCURADOR', 'DEFENSOR'].some(t => type.includes(t))) return 'ADVOGADO';
        if (['PERITO', 'ASSISTENTE'].some(t => type.includes(t))) return 'PERITO';
        if (['TESTEMUNHA'].some(t => type.includes(t))) return 'TESTEMUNHA';
        if (['JUIZ', 'MAGISTRADO', 'RELATOR'].some(t => type.includes(t))) return 'MAGISTRADO';
        return 'TERCEIRO';
    }

    private async syncParties(parties: any[], tenantId: string, judgeName?: string) {
        const createdContacts = [];

        // 1. Sync Judge if present
        if (judgeName && judgeName !== 'Não informado') {
            const judgeExists = await this.prisma.contact.findFirst({
                where: { tenantId, name: judgeName, category: 'MAGISTRADO' }
            });
            if (!judgeExists) {
                try {
                     const newJudge = await this.prisma.contact.create({
                        data: {
                            tenantId,
                            name: judgeName,
                            personType: 'PF', // Juiz é sempre PF
                            category: 'MAGISTRADO',
                            notes: 'Importado automaticamente via Processo'
                        }
                    });
                    console.log(`Created Magistrate contact: ${judgeName}`);
                    createdContacts.push({ name: judgeName, type: 'MAGISTRADO', id: newJudge.id });
                } catch (e) { console.warn('Error creating judge:', e); }
            }
        }

        // 2. Sync Parties
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

            // Normalizar Categoria
            const normalizedCategory = this.normalizePartyType(type);

            if (!existingContact) {
                const isPJ = cleanDoc && cleanDoc.length > 11;
                const personType = isPJ ? 'PJ' : 'PF';

                try {
                    const newContact = await this.prisma.contact.create({
                        data: {
                            tenantId,
                            name: name.substring(0, 100), 
                            personType,
                            category: normalizedCategory, 
                            pfDetails: !isPJ ? {
                                create: { cpf: cleanDoc }
                            } : undefined,
                            pjDetails: isPJ ? {
                                create: { cnpj: cleanDoc, companyName: name }
                            } : undefined
                        }
                    });
                    console.log(`Created contact for party: ${name} (${normalizedCategory})`);
                    createdContacts.push({ name, personType, id: newContact.id });
                } catch (e) {
                    console.warn(`Failed to create contact for ${name}:`, e.message);
                }
            }
        }
        
        if (createdContacts.length > 0) {
            this.logAudit('4_CREATED_CONTACTS', createdContacts);
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
