import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@drx/database';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: any, tenantId: string) {
    // 1. Validar tenant
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true, users: true }
    });

    if (!tenant) throw new NotFoundException('Empresa não encontrada');

    // 2. Validar limite do plano
    if (tenant.plan) {
       const currentUsers = tenant.users.length;
       if (currentUsers >= tenant.plan.maxUsers) {
           throw new ForbiddenException(`Limite de usuários do plano ${tenant.plan.name} atingido (${tenant.plan.maxUsers}). Faça upgrade para adicionar mais.`);
       }
    }

    // 3. Validar email único
    const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email }
    });
    if (existingUser) throw new BadRequestException('E-mail já cadastrado no sistema');

    // 4. Criar Usuário
    const hashedPassword = await bcrypt.hash(data.password, 10);

    return this.prisma.user.create({
        data: {
            name: data.name,
            email: data.email,
            password: hashedPassword,
            role: data.role || 'MEMBER',
            permissions: data.permissions || {},
            tenantId: tenantId
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            permissions: true
        }
    });
  }

  async findAll(tenantId: string, search?: string) {
    return this.prisma.user.findMany({
        where: { 
            tenantId,
            OR: search ? [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ] : undefined
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            permissions: true,
            createdAt: true,
            updatedAt: true
        }
    });
  }

  async remove(id: string, tenantId: string) {
      // Garantir que usuário pertence ao tenant
      const user = await this.prisma.user.findFirst({
          where: { id, tenantId }
      });

      if (!user) throw new NotFoundException('Usuário não encontrado');
      if (user.role === 'OWNER') throw new ForbiddenException('Não é possível remover o dono da conta');

      return this.prisma.user.delete({
          where: { id }
      });
  }

  async update(id: string, data: any, tenantId: string) {
    const user = await this.prisma.user.findFirst({
        where: { id, tenantId }
    });

    if (!user) throw new NotFoundException('Usuário não encontrado');

    const updateData: any = { ...data };
    if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    
    // Evitar mudança de tenantId
    delete updateData.tenantId;

    return this.prisma.user.update({
        where: { id },
        data: updateData,
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            permissions: true
        }
    });
  }
}
