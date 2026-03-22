import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '@drx/database';
import * as crypto from 'crypto';

@Injectable()
export class TrustedDeviceService {
  constructor(private prisma: PrismaService) {}

  private hashDeviceToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async findTrustedDevice(options: {
    tenantId: string;
    userId: string;
    deviceToken?: string | null;
  }) {
    const deviceToken = (options.deviceToken || '').trim();
    if (!deviceToken) return null;

    const tokenHash = this.hashDeviceToken(deviceToken);
    return this.prisma.trustedDevice.findFirst({
      where: {
        tenantId: options.tenantId,
        userId: options.userId,
        tokenHash,
        revokedAt: null,
      },
      select: { id: true, name: true },
    });
  }

  async assertTrustedDevice(options: {
    tenantId: string;
    userId: string;
    deviceToken?: string | null;
  }) {
    const device = await this.findTrustedDevice(options);
    if (!device) {
      throw new ForbiddenException('Ação permitida apenas em computador confiável.');
    }
    await this.prisma.trustedDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });
    return device;
  }
}
