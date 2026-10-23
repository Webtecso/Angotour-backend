import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { AdminUser } from '../entities/admin-user.entity';

interface AdminJwtPayload {
  sub: string;
  email: string;
  type: string;
}

/**
 * Token de admin: so passa com type === 'admin' e se o utilizador continuar
 * ativo na base de dados (desativar um admin corta o acesso de imediato).
 */
@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(@InjectRepository(AdminUser) private readonly admins: Repository<AdminUser>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'troca-isto-em-producao',
    });
  }

  async validate(payload: AdminJwtPayload) {
    if (payload.type !== 'admin') throw new UnauthorizedException('Token nao e de administrador.');
    const admin = await this.admins.findOne({ where: { id: payload.sub } });
    if (!admin || !admin.isActive) throw new UnauthorizedException('Conta de administrador inativa.');
    return { adminId: admin.id, email: admin.email, fullName: admin.fullName, role: admin.role };
  }
}
