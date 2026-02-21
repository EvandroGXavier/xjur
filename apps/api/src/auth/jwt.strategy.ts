import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    const secret = configService.get<string>('JWT_SECRET') || 'drx-default-secret-change-me-in-production';
    if (!configService.get<string>('JWT_SECRET')) {
      console.warn('⚠️  [JwtStrategy] JWT_SECRET não definido! Usando fallback. Configure JWT_SECRET no ambiente de produção!');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    // Aqui injetamos o tenantId e userId no request.user
    return { userId: payload.sub, email: payload.email, tenantId: payload.tenantId, role: payload.role, name: payload.name };
  }
}
