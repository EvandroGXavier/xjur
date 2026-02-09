
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@drx/database';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SaasService {
  constructor(private prisma: PrismaService) {}

  async registerTenant(data: any) {
    const { name, email, document, mobile, password, adminName } = data;

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
          name: adminName || name, // Use adminName if provided, else fallback to tenant name
          email: email,
          password: await bcrypt.hash(password, 10),
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

  async updateTenant(id: string, data: any) {
    const { name, document, planId, isActive, password } = data;

    // Check if document belongs to another tenant
    if (document) {
      const existing = await this.prisma.tenant.findUnique({ where: { document } });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Documento já utilizado por outra empresa.');
      }
    }

    // Update Tenant
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        name,
        document,
        planId,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    // Optional: Update Owner Password
    if (password) {
        // Find owner
        const owner = await this.prisma.user.findFirst({
            where: { tenantId: id, role: 'OWNER' }
        });
        if (owner) {
            await this.prisma.user.update({
                where: { id: owner.id },
                data: { password: await bcrypt.hash(password, 10) }
            });
        }
    }

    return tenant;
  }

  async deleteTenant(id: string) {
    // Delete related data first or rely on cascade?
    // User relation is mandatory in schema but maybe assume cascade defined or handle manually.
    // For now, let's delete users first
    await this.prisma.user.deleteMany({ where: { tenantId: id } });
    return this.prisma.tenant.delete({ where: { id } });
  }

  async getTenants() {
      return this.prisma.tenant.findMany({
          include: { plan: true },
          orderBy: { createdAt: 'desc' }
      });
  }

  // --- PLANS CRUD ---

  async createPlan(data: any) {
      return this.prisma.plan.create({ data });
  }

  async getPlans() {
      return this.prisma.plan.findMany({ orderBy: { price: 'asc' } });
  }

  async updatePlan(id: string, data: any) {
      return this.prisma.plan.update({
          where: { id },
          data
      });
  }

  async deletePlan(id: string) {
      // Check usage
      const usage = await this.prisma.tenant.count({ where: { planId: id } });
      if (usage > 0) {
          throw new BadRequestException('Não é possível excluir um plano em uso.');
      }
      return this.prisma.plan.delete({ where: { id } });
  }
}
