import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@drx/database';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }

    throw new UnauthorizedException('Credenciais inválidas ou usuário inexistente.');
  }

  private hashDeviceToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private createDeviceToken() {
    return crypto.randomBytes(32).toString('base64url');
  }

  async login(
    user: any,
    options?: {
      trustDevice?: boolean;
      deviceName?: string;
      deviceToken?: string;
      userAgent?: string;
      ip?: string;
    },
  ) {
    const payload: JwtPayload = {
      email: user.email,
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      name: user.name,
    };

    let trustedDevice: { id: string; name: string } | null = null;
    let returnedDeviceToken: string | undefined;

    const normalizedDeviceName =
      (options?.deviceName || '').trim().slice(0, 80) || 'Computador confiável';
    const providedDeviceToken = (options?.deviceToken || '').trim();

    if (providedDeviceToken) {
      const tokenHash = this.hashDeviceToken(providedDeviceToken);
      const device = await this.prisma.trustedDevice.findFirst({
        where: {
          tenantId: user.tenantId,
          userId: user.id,
          tokenHash,
          revokedAt: null,
        },
        select: { id: true, name: true },
      });

      if (device) {
        trustedDevice = device;
        await this.prisma.trustedDevice.update({
          where: { id: device.id },
          data: {
            lastSeenAt: new Date(),
            userAgent: options?.userAgent || undefined,
            ip: options?.ip || undefined,
          },
        });
      }
    }

    if (!trustedDevice && options?.trustDevice) {
      const deviceToken = this.createDeviceToken();
      const tokenHash = this.hashDeviceToken(deviceToken);
      const created = await this.prisma.trustedDevice.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          name: normalizedDeviceName,
          tokenHash,
          userAgent: options?.userAgent || null,
          ip: options?.ip || null,
          lastSeenAt: new Date(),
        },
        select: { id: true, name: true },
      });

      trustedDevice = created;
      returnedDeviceToken = deviceToken;
    }

    return {
      access_token: this.jwtService.sign(payload),
      user,
      isTrustedDevice: Boolean(trustedDevice),
      trustedDevice,
      deviceToken: returnedDeviceToken,
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { message: 'Se o e-mail existir, você receberá um link de recuperação.' };
    }

    const payload = { sub: user.id, type: 'recovery' };
    const recoverySecret =
      this.configService.get<string>('RECOVERY_JWT_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'RECOVERY_SECRET_CHANGE_ME';

    const token = this.jwtService.sign(payload, {
      expiresIn: '1h',
      secret: recoverySecret,
    });

    const webUrl = this.configService.get<string>('WEB_URL') || 'http://localhost:5173';
    const resetUrl = `${webUrl.replace(/\/+$/, '')}/reset-password?token=${token}`;

    if ((process.env.NODE_ENV || '').toLowerCase() !== 'production') {
      console.log(`[AUTH] Link de recuperação para ${email}: ${resetUrl}`);
    }

    return { message: 'Se o e-mail existir, você receberá um link de recuperação.' };
  }

  async resetPassword(token: string, newPass: string) {
    try {
      const recoverySecret =
        this.configService.get<string>('RECOVERY_JWT_SECRET') ||
        this.configService.get<string>('JWT_SECRET') ||
        'RECOVERY_SECRET_CHANGE_ME';
      const payload = this.jwtService.verify(token, { secret: recoverySecret });
      if (payload.type !== 'recovery') {
        throw new UnauthorizedException('Token inválido.');
      }

      const hashedPassword = await bcrypt.hash(newPass, 10);

      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { password: hashedPassword },
      });

      return { message: 'Senha redefinida com sucesso!' };
    } catch {
      throw new UnauthorizedException('Link de recuperação inválido ou expirado.');
    }
  }

  async listTrustedDevices(tenantId: string, userId: string) {
    const devices = await this.prisma.trustedDevice.findMany({
      where: { tenantId, userId },
      orderBy: [{ revokedAt: 'asc' }, { lastSeenAt: 'desc' }],
      select: {
        id: true,
        name: true,
        userAgent: true,
        ip: true,
        lastSeenAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
    return devices;
  }

  async revokeTrustedDevice(tenantId: string, userId: string, deviceId: string) {
    const device = await this.prisma.trustedDevice.findFirst({
      where: { id: deviceId, tenantId, userId },
      select: { id: true, revokedAt: true },
    });
    if (!device) {
      throw new UnauthorizedException('Dispositivo não encontrado.');
    }
    if (device.revokedAt) {
      return { ok: true };
    }
    await this.prisma.trustedDevice.update({
      where: { id: deviceId },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
}
