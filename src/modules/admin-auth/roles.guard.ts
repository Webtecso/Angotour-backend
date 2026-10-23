import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from './admin-roles';
import { ROLES_KEY } from './roles.decorator';

/** Usar depois de AuthGuard('admin-jwt'): @UseGuards(AuthGuard('admin-jwt'), RolesGuard) */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AdminRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) return true;
    const user = context.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException('Sem permissao.');
    if (user.role === 'super_admin') return true;
    if (!required.includes(user.role)) throw new ForbiddenException('O teu papel nao tem permissao para esta acao.');
    return true;
  }
}
