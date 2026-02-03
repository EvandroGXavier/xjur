
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // TODO: Move secret to environment variable
      secretOrKey: 'secretKey', 
    });
  }

  async validate(payload: any) {
    // Aqui injetamos o tenantId e userId no request.user
    return { userId: payload.sub, email: payload.email, tenantId: payload.tenantId, role: payload.role };
  }
}
