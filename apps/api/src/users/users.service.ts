import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@drx/database';
import * as bcrypt from 'bcryptjs';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';

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
            ...(data.theme ? { theme: data.theme } : {}),
            ...(typeof data.soundEnabled === 'boolean' ? { soundEnabled: data.soundEnabled } : {}),
            ...(typeof data.sidebarCollapsed === 'boolean' ? { sidebarCollapsed: data.sidebarCollapsed } : {}),
            ...(data.startupModuleMode ? { startupModuleMode: data.startupModuleMode } : {}),
            ...(data.homeModuleId ? { homeModuleId: data.homeModuleId } : {}),
            ...(data.lastModuleId ? { lastModuleId: data.lastModuleId } : {}),
            ...(data.preferences && typeof data.preferences === 'object' ? { preferences: data.preferences } : {}),
            tenantId: tenantId
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            permissions: true,
            theme: true,
            soundEnabled: true,
            sidebarCollapsed: true,
            startupModuleMode: true,
            homeModuleId: true,
            lastModuleId: true,
            preferences: true,
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
            theme: true,
            soundEnabled: true,
            sidebarCollapsed: true,
            startupModuleMode: true,
            homeModuleId: true,
            lastModuleId: true,
            preferences: true,
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
            permissions: true,
            theme: true,
            soundEnabled: true,
            sidebarCollapsed: true,
            startupModuleMode: true,
            homeModuleId: true,
            lastModuleId: true,
            preferences: true,
        }
    });
  }

  async updatePreferences(id: string, data: UpdateUserPreferencesDto) {
    const hasPreferencesObject = Boolean(data.preferences && typeof data.preferences === 'object');

    if (!hasPreferencesObject) {
      return this.prisma.user.update({
        where: { id },
        data: {
          ...(data.theme ? { theme: data.theme } : {}),
          ...(data.soundEnabled !== undefined ? { soundEnabled: data.soundEnabled } : {}),
          ...(data.sidebarCollapsed !== undefined ? { sidebarCollapsed: data.sidebarCollapsed } : {}),
          ...(data.startupModuleMode ? { startupModuleMode: data.startupModuleMode } : {}),
          ...(data.homeModuleId ? { homeModuleId: data.homeModuleId } : {}),
          ...(data.lastModuleId ? { lastModuleId: data.lastModuleId } : {}),
        },
        select: {
          id: true,
          theme: true,
          soundEnabled: true,
          sidebarCollapsed: true,
          startupModuleMode: true,
          homeModuleId: true,
          lastModuleId: true,
          preferences: true,
        },
      });
    }

    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { preferences: true },
    });

    const mergedPreferences = {
      ...(current?.preferences && typeof current.preferences === 'object' ? (current.preferences as any) : {}),
      ...(data.preferences as any),
    };

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.theme ? { theme: data.theme } : {}),
        ...(data.soundEnabled !== undefined ? { soundEnabled: data.soundEnabled } : {}),
        ...(data.sidebarCollapsed !== undefined ? { sidebarCollapsed: data.sidebarCollapsed } : {}),
        ...(data.startupModuleMode ? { startupModuleMode: data.startupModuleMode } : {}),
        ...(data.homeModuleId ? { homeModuleId: data.homeModuleId } : {}),
        ...(data.lastModuleId ? { lastModuleId: data.lastModuleId } : {}),
        preferences: mergedPreferences,
      },
      select: {
        id: true,
        theme: true,
        soundEnabled: true,
        sidebarCollapsed: true,
        startupModuleMode: true,
        homeModuleId: true,
        lastModuleId: true,
        preferences: true,
      },
    });
  }
}
