import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface DriverJwtPayload {
  sub: string;
  phone: string;
  type: string;
}

/**
 * Estrategia separada da JwtStrategy do passageiro. O token do motorista
 * carrega type: 'driver' - sem isso, o token e rejeitado mesmo que a
 * assinatura seja valida. Evita que um JWT de passageiro (ou qualquer
 * outro) consiga chamar rotas de motorista.
 */
@Injectable()
export class DriverJwtStrategy extends PassportStrategy(Strategy, 'driver-jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'troca-isto-em-producao',
    });
  }

  validate(payload: DriverJwtPayload) {
    if (payload.type !== 'driver') {
      throw new UnauthorizedException('Token nao e de motorista.');
    }
    return { driverId: payload.sub, phone: payload.phone };
  }
}
