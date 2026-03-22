import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { TrustedDeviceService } from './trusted-device.service';

@Injectable()
export class TrustedDeviceGuard implements CanActivate {
  constructor(private trustedDeviceService: TrustedDeviceService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.userId || !user?.tenantId) {
      return false;
    }

    const deviceTokenHeader = request.headers['x-device-token'];
    const deviceToken = Array.isArray(deviceTokenHeader)
      ? deviceTokenHeader[0]
      : (deviceTokenHeader as string | undefined);

    const resolved = await this.trustedDeviceService.assertTrustedDevice({
      tenantId: user.tenantId,
      userId: user.sub || user.userId,
      email: user.email,
      deviceToken,
    });

    request.trustedDevice = resolved;
    return true;
  }
}
