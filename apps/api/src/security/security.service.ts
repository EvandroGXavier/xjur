import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@drx/database';

@Injectable()
export class SecurityService {
  constructor(private prisma: PrismaService) {}

  async getSetting(tenantId: string, entityType: string, entityId: string) {
    let setting = await this.prisma.securitySetting.findUnique({
      where: {
        tenantId_entityType_entityId: {
          tenantId,
          entityType,
          entityId,
        },
      },
    });

    if (!setting) {
      setting = await this.prisma.securitySetting.create({
        data: {
          tenantId,
          entityType,
          entityId,
          observation: '',
        },
      });
    }

    return setting;
  }

  async updateSetting(tenantId: string, entityType: string, entityId: string, observation: string) {
    return this.prisma.securitySetting.upsert({
      where: {
        tenantId_entityType_entityId: {
          tenantId,
          entityType,
          entityId,
        },
      },
      update: { observation },
      create: {
        tenantId,
        entityType,
        entityId,
        observation,
      },
    });
  }

  // Helpers para "Hash/Ofuscação" reversível (para ser 'invisível' no banco mas visível na UI)
  private encode(text: string) {
    if (!text) return text;
    return Buffer.from(text).toString('base64');
  }

  private decode(text: string) {
    if (!text) return text;
    try {
      return Buffer.from(text, 'base64').toString('utf8');
    } catch {
      return text;
    }
  }

  async listSecrets(tenantId: string, entityType: string, entityId: string) {
    const secrets = await this.prisma.securitySecret.findMany({
      where: {
        tenantId,
        entityType,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return secrets.map(s => ({
      ...s,
      password: this.decode(s.password),
      privateKey: this.decode(s.privateKey),
    }));
  }

  async createSecret(tenantId: string, data: any) {
    return this.prisma.securitySecret.create({
      data: {
        ...data,
        tenantId,
        password: this.encode(data.password),
        privateKey: this.encode(data.privateKey),
      },
    });
  }

  async updateSecret(id: string, tenantId: string, data: any) {
    const secret = await this.prisma.securitySecret.findFirst({
      where: { id, tenantId },
    });

    if (!secret) throw new NotFoundException('Segredo não encontrado');

    const updateData = { ...data };
    if (updateData.password) updateData.password = this.encode(updateData.password);
    if (updateData.privateKey) updateData.privateKey = this.encode(updateData.privateKey);

    return this.prisma.securitySecret.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteSecret(id: string, tenantId: string) {
    const secret = await this.prisma.securitySecret.findFirst({
      where: { id, tenantId },
    });

    if (!secret) throw new NotFoundException('Segredo não encontrado');

    return this.prisma.securitySecret.delete({
      where: { id },
    });
  }
}
