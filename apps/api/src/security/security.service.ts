import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@drx/database';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

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

  private getSecretsKey() {
    const raw = (process.env.SECURITY_SECRETS_KEY || '').trim();
    if (!raw) return null;

    try {
      // Accept base64 or hex.
      if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
      const buf = Buffer.from(raw, 'base64');
      if (buf.length === 32) return buf;
      return crypto.createHash('sha256').update(buf).digest();
    } catch {
      return null;
    }
  }

  private encrypt(text: string) {
    const key = this.getSecretsKey();
    if (!key) {
      // Backward-compatible fallback (not encryption).
      return Buffer.from(text).toString('base64');
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const b64u = (buf: Buffer) =>
      buf
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

    return `enc_v1:${b64u(iv)}:${b64u(tag)}:${b64u(ciphertext)}`;
  }

  private decrypt(text: string) {
    const key = this.getSecretsKey();
    if (!key) return null;

    const parts = text.split(':');
    if (parts.length !== 4 || parts[0] !== 'enc_v1') return null;

    const fromB64u = (value: string) => {
      const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
      const pad = '='.repeat((4 - (normalized.length % 4)) % 4);
      return Buffer.from(normalized + pad, 'base64');
    };

    const iv = fromB64u(parts[1]);
    const tag = fromB64u(parts[2]);
    const ciphertext = fromB64u(parts[3]);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  }

  private encryptBuffer(data: Buffer) {
    const key = this.getSecretsKey();
    if (!key) return data;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]);
  }

  private decryptBuffer(data: Buffer) {
    const key = this.getSecretsKey();
    if (!key || data.length < 28) return data;
    try {
      const iv = data.slice(0, 12);
      const tag = data.slice(12, 28);
      const ciphertext = data.slice(28);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      return data;
    }
  }

  private encode(text?: string | null) {
    if (!text) return text as any;
    return this.encrypt(text);
  }

  private decode(text?: string | null) {
    if (!text) return text as any;

    // New format
    const decrypted = this.decrypt(text);
    if (typeof decrypted === 'string') return decrypted;

    // Legacy base64 format (existing data)
    try {
      const decoded = Buffer.from(text, 'base64').toString('utf8');
      // Heuristic: avoid returning garbage if it's not base64.
      if (decoded && /[^\u0000-\u001F]/.test(decoded)) return decoded;
      return decoded;
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

    return secrets.map((s) => ({
      ...s,
      password: this.decode(s.password),
      privateKey: this.decode(s.privateKey),
    }));
  }

  decodeSecretValue(value?: string | null) {
    return this.decode(value);
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
    if (typeof updateData.password === 'string') updateData.password = this.encode(updateData.password);
    if (typeof updateData.privateKey === 'string') updateData.privateKey = this.encode(updateData.privateKey);

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

  async uploadSecretFile(id: string, tenantId: string, file: any) {
    const secret = await this.prisma.securitySecret.findFirst({
      where: { id, tenantId },
    });
    if (!secret) throw new NotFoundException('Segredo não encontrado');

    const uploadDir = path.join(process.cwd(), 'uploads', 'security');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const fileName = `${id}-${Date.now()}-${file.originalname}`;
    const filePath = path.join(uploadDir, fileName);

    const encrypted = this.encryptBuffer(file.buffer);
    fs.writeFileSync(filePath, encrypted);

    return this.prisma.securitySecret.update({
      where: { id },
      data: { fileUrl: fileName },
    });
  }

  async downloadSecretFile(id: string, tenantId: string) {
    const secret = await this.prisma.securitySecret.findFirst({
      where: { id, tenantId },
    });
    if (!secret || !secret.fileUrl) throw new NotFoundException('Arquivo não encontrado');

    const filePath = path.join(process.cwd(), 'uploads', 'security', secret.fileUrl);
    if (!fs.existsSync(filePath)) throw new NotFoundException('Arquivo não encontrado em disco');

    const encrypted = fs.readFileSync(filePath);
    const decrypted = this.decryptBuffer(encrypted);

    return {
      buffer: decrypted,
      originalName: secret.fileUrl.split('-').slice(2).join('-'),
    };
  }
}
