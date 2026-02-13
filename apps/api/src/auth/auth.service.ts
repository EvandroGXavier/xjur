import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@drx/database';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
        where: { email: email },
        include: { tenant: true }
    });

    if (user && await bcrypt.compare(pass, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    
    // Se falhar a validação, lançamos a exceção aqui ou retornamos null para o controller tratar.
    // O padrão NestJS normalmente retorna null aqui e o Guard/Controller lança a exceção, 
    // mas para login direto, lançar aqui é mais seguro/claro.
    throw new UnauthorizedException('Credenciais inválidas ou usuário inexistente.');
  }

  async login(user: any) {
    const payload: JwtPayload = { 
        email: user.email, 
        sub: user.id, 
        tenantId: user.tenantId, // Supondo que o user venha com tenantId ou tenant.id
        role: user.role,
        name: user.name
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: user
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
        // Por segurança, não revelamos que o email não existe
        return { message: 'Se o e-mail existir, você receberá um link de recuperação.' };
    }

    // Gerar token de recuperação (válido por 1h)
    const payload = { sub: user.id, type: 'recovery' };
    const token = this.jwtService.sign(payload, { expiresIn: '1h', secret: 'RECOVERY_SECRET_CHANGE_ME' }); // TODO: Mover secret para .env

    // URL do Frontend para resetar
    const resetUrl = `http://localhost:5173/reset-password?token=${token}`; // TODO: Pegar URL do .env

    console.log(`[AUTH] Link de recuperação para ${email}: ${resetUrl}`);

    // TODO: Enviar E-mail real quando MailerModule estiver configurado
    // await this.mailerService.sendMail(...)
    
    return { message: 'Se o e-mail existir, você receberá um link de recuperação.' };
  }

  async resetPassword(token: string, newPass: string) {
      try {
          const payload = this.jwtService.verify(token, { secret: 'RECOVERY_SECRET_CHANGE_ME' });
          if (payload.type !== 'recovery') {
              throw new UnauthorizedException('Token inválido.');
          }

          const hashedPassword = await bcrypt.hash(newPass, 10);
          
          await this.prisma.user.update({
              where: { id: payload.sub },
              data: { password: hashedPassword }
          });

          return { message: 'Senha redefinida com sucesso!' };

      } catch (e) {
          throw new UnauthorizedException('Link de recuperação inválido ou expirado.');
      }
  }
}
