import { HttpException, HttpStatus, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser } from './entities/admin-user.entity';
import { AdminAuditService } from './admin-audit.service';
import { hashPassword, verifyPassword } from './password.util';

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

@Injectable()
export class AdminAuthService implements OnModuleInit {
  // Falhas de login por email (em memoria; em producao com varias instancias passa para Redis).
  private readonly failures = new Map<string, { count: number; lockedUntil: number }>();

  constructor(
    @InjectRepository(AdminUser) private readonly admins: Repository<AdminUser>,
    private readonly jwt: JwtService,
    private readonly audit: AdminAuditService,
  ) {}

  /** Cria o primeiro super_admin a partir do .env, so se ainda nao existir nenhum admin. */
  async onModuleInit(): Promise<void> {
    try {
      if ((await this.admins.count()) > 0) return;
      const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
      const password = process.env.ADMIN_SEED_PASSWORD;
      if (!email || !password) {
        // eslint-disable-next-line no-console
        console.warn('[AdminAuth] Nenhum admin existe e ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD nao estao no .env.');
        return;
      }
      await this.admins.save(
        this.admins.create({ email, fullName: 'Super Admin', passwordHash: await hashPassword(password), role: 'super_admin' }),
      );
      // eslint-disable-next-line no-console
      console.log('[AdminAuth] Primeiro super_admin criado: ' + email);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[AdminAuth] nao foi possivel criar o admin inicial:', (e as Error).message);
    }
  }

  async login(emailRaw: string, password: string) {
    const email = emailRaw.trim().toLowerCase();
    const now = Date.now();
    const state = this.failures.get(email) ?? { count: 0, lockedUntil: 0 };
    if (state.lockedUntil > now) {
      const minutes = Math.ceil((state.lockedUntil - now) / 60000);
      throw new HttpException('Demasiadas tentativas. Tenta novamente dentro de ' + minutes + ' min.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const admin = await this.admins.findOne({ where: { email } });
    const ok = !!admin && admin.isActive && (await verifyPassword(password, admin.passwordHash));
    if (!ok) {
      state.count += 1;
      if (state.count >= MAX_FAILURES) {
        state.count = 0;
        state.lockedUntil = now + LOCK_MS;
      }
      this.failures.set(email, state);
      await this.audit.record({ adminId: admin?.id ?? null, adminEmail: email, action: 'login_failed' });
      throw new UnauthorizedException('Email ou password incorretos.');
    }

    this.failures.delete(email);
    admin.lastLoginAt = new Date();
    await this.admins.save(admin);
    await this.audit.record({ adminId: admin.id, adminEmail: admin.email, action: 'login' });

    const accessToken = this.jwt.sign({ sub: admin.id, email: admin.email, type: 'admin' });
    return { accessToken, admin: { id: admin.id, email: admin.email, fullName: admin.fullName, role: admin.role } };
  }
}
