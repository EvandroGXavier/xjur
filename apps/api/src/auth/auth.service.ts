import { Injectable } from '@nestjs/common';
import { PrismaService } from '@drx/database';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    // Agora busca na tabela USER, não Contact
    const user = await this.prisma.user.findUnique({
        where: { email: email },
        include: { tenant: true } // Incluir dados do Tenant
    });

    if (user && await bcrypt.compare(pass, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { 
        email: user.email, 
        sub: user.id, 
        tenantId: user.tenantId,
        role: user.role 
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: user
    };
  }
}
