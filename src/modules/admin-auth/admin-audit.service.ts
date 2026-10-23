import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAuditLog } from './entities/admin-audit-log.entity';

export interface AuditEntry {
  adminId?: string | null;
  adminEmail?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class AdminAuditService {
  constructor(@InjectRepository(AdminAuditLog) private readonly logs: Repository<AdminAuditLog>) {}

  /** Nunca deixa uma falha de auditoria partir a operacao principal. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.logs.save(this.logs.create(entry));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[Audit] falha ao registar:', (e as Error).message);
    }
  }

  list(limit = 100): Promise<AdminAuditLog[]> {
    return this.logs.find({ order: { createdAt: 'DESC' }, take: Math.min(Math.max(limit, 1), 500) });
  }
}
