import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MonthlyContract } from './entities/monthly-contract.entity';
import { todayLuanda } from './monthly-executions.service';

/** Ciclo de vida dos contratos. Idempotente: pode correr quantas vezes for preciso. */
@Injectable()
export class MonthlyMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('MonthlyMaintenance');
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(@InjectRepository(MonthlyContract) private readonly contracts: Repository<MonthlyContract>) {}

  onModuleInit() {
    setTimeout(() => this.run().catch((e) => this.log.warn((e as Error).message)), 15000);
    this.timer = setInterval(() => this.run().catch((e) => this.log.warn((e as Error).message)), 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<{ concluded: number; expiredProposals: number; staleUnpaid: number }> {
    const today = todayLuanda();

    const concluded = await this.contracts.query(
      `UPDATE monthly_contracts SET status = 'concluido', "updatedAt" = now()
       WHERE status = 'ativo' AND "endDate" IS NOT NULL AND "endDate" < $1::date RETURNING id`,
      [today],
    );

    const expired = await this.contracts.query(
      `UPDATE monthly_contracts SET status = 'cancelado', "updatedAt" = now()
       WHERE status = 'proposta_emitida' AND "proposalExpiresAt" IS NOT NULL AND "proposalExpiresAt" < now()
       RETURNING "requestId"`,
    );
    for (const r of expired) {
      await this.contracts.query(
        `UPDATE monthly_service_requests SET status = 'expired' WHERE id = $1 AND status IN ('proposal_available', 'pending', 'matching')`,
        [r.requestId],
      );
    }

    const stale = await this.contracts.query(
      `UPDATE monthly_contracts SET status = 'cancelado', "updatedAt" = now()
       WHERE status = 'aguardando_pagamento' AND "updatedAt" < now() - interval '7 days' RETURNING id`,
    );

    const result = { concluded: concluded.length, expiredProposals: expired.length, staleUnpaid: stale.length };
    if (result.concluded + result.expiredProposals + result.staleUnpaid > 0) this.log.log(JSON.stringify(result));
    return result;
  }
}
