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
        // Validação Mínima
        if (data.category === 'JUDICIAL' && !data.cnj) {
            throw new BadRequestException('CNJ é obrigatório para processos judiciais.');
        }
        if (data.category === 'EXTRAJUDICIAL' && !data.title) {
            throw new BadRequestException('Título é obrigatório para casos.');
        }

        // 1. Resolver Tenant (Mockado se não vier, ou pegar do primeiro existente)
        let tenantId = data.tenantId;
        if (!tenantId) {
            const defaultTenant = await this.prisma.tenant.findFirst();
            if (!defaultTenant) {
                 // Auto-create default tenant for Dev/First Run
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

        // 2. Gerar Código para Casos (se não tiver CNJ)
        let code = data.cnj; // Se for judicial, o código é o CNJ
        if (data.category === 'EXTRAJUDICIAL') {
             // Formato: CASO-{YYYY}-{SEQ}
             // Ex: CASO-2025-0001
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

        // 3. Persistir
        return this.prisma.process.create({
            data: {
                tenantId,
                contactId: data.contactId, // Pode ser null
                cnj: data.cnj,  // Nullable agora
                category: data.category,
                title: data.title,
                code: code,
                description: data.description, // Campo rico
                folder: data.folder, // Pasta na nuvem
                
                // Mapeamento de campos do Crawler
                court: data.court,
                courtSystem: data.courtSystem,
                vars: data.vars,
                district: data.district,
                status: data.status || 'ATIVO',
                
                area: data.area,
                subject: data.subject,
                class: data.class,
                distributionDate: data.distributionDate ? new Date(data.distributionDate) : new Date(),
                judge: data.judge,
                value: data.value,
                
                parties: data.parties || [], // JSON
                metadata: data.metadata || {}, // JSON
            }
        });
    }
    
    async findAll(params: { tenantId?: string, search?: string }) {
        // Mock tenant search
         const defaultTenant = await this.prisma.tenant.findFirst();
         const tenantId = params.tenantId || defaultTenant?.id;

         return this.prisma.process.findMany({
             where: {
                 tenantId: tenantId,
                 OR: params.search ? [
                     { cnj: { contains: params.search } },
                     { title: { contains: params.search, mode: 'insensitive' } },
                     { parties: { path: [], string_contains: params.search } } // JSON filter (advanced) - Simpler: filter in memory if prisma unsupported
                 ] : undefined
             },
             orderBy: { createdAt: 'desc' }
         });
    }
}
