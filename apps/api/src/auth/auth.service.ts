import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../packages/database/dist/index.js'; // Ajustar import se necessário

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.prisma.contact.findFirst({
        where: { email: email }
    });

    if (user && user.password === pass) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }
}
