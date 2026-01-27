
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@drx/database';

@Injectable()
export class SaasService {
  constructor(private prisma: PrismaService) {}

  async registerTenant(data: any) {
    const { name, email, document, mobile, password } = data;

    // 1. Verificar se Tenant já existe (pelo Document)
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { document },
    });
    if (existingTenant) {
      throw new BadRequestException('Empresa já cadastrada com este documento.');
    }

    // 2. Verificar se User já existe (pelo Email) - Globalmente (Email deve ser único no sistema todo ou por tenant?)
    // Schema diz User.email @unique, então é global.
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new BadRequestException('E-mail já cadastrado no sistema.');
    }

    // 3. Obter plano padrão (ou definido no request)
    // Se não enviado, assume 'Basic' ou 'Pro'. Vamos buscar 'Full' para teste ou parametrizar.
    const plan = await this.prisma.plan.findFirst({
        where: { name: 'Full' } // Default para testes
    });
    
    // 4. Transaction para criar Tenant e User atomicamente
    return this.prisma.$transaction(async (tx) => {
      // Cria Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: name,
          document: document,
          planId: plan?.id,
          isActive: true,
        },
      });

      // Cria User Admin
      const user = await tx.user.create({
        data: {
          name: name, // Nome do usuário = Nome do solicitante? O request deve separar.
          email: email,
          password: password, // TODO: Hash password
          role: 'OWNER',
          tenantId: tenant.id,
        },
      });

      // TODO: Criar Contato na Empresa Principal (CRM) - Opcional por agora
      
      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        user: {
            id: user.id,
            email: user.email,
            role: user.role
        }
      };
    });
  }

  async getTenants() {
      return this.prisma.tenant.findMany({
          include: { plan: true }
      });
  }
}
