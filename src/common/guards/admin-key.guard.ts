import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * Protecao minima para rotas internas de administracao, enquanto nao existe
 * um sistema de roles/admin a serio no backend. Exige o header x-admin-key
 * a bater com ADMIN_API_KEY no .env. Nunca deve ficar sem essa variavel
 * definida - sem ela, a rota fica sempre bloqueada (nunca aberta por omissao).
 */
@Injectable()
export class AdminKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const expected = process.env.ADMIN_API_KEY;
    const provided = req.headers['x-admin-key'];

    if (!expected) {
      throw new UnauthorizedException('ADMIN_API_KEY nao esta configurada no servidor.');
    }
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Chave de administrador invalida.');
    }
    return true;
  }
}
