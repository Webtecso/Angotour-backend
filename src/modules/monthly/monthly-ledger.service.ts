import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MonthlyLedgerEntry } from './entities/monthly-ledger-entry.entity';
import { MonthlyContract } from './entities/monthly-contract.entity';
import { getCommissionRate } from '../../common/platform-config';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class MonthlyLedgerService {
  constructor(@InjectRepository(MonthlyLedgerEntry) private readonly entries: Repository<MonthlyLedgerEntry>) {}

  private period(c: MonthlyContract) {
    return String(c.startDate).slice(0, 7);
  }

  private async put(contractId: string, period: string, kind: string, amountKz: number, status: string, meta: Record<string, unknown>) {
    await this.entries
      .createQueryBuilder()
      .insert()
      .into(MonthlyLedgerEntry)
      .values({ contractId, period, kind, amountKz: Math.round(amountKz), status, meta } as any)
      .orIgnore()
      .execute();
  }

  /** Pagamento confirmado: receita bruta e comissao AngoTour (com a taxa do momento). Idempotente. */
  async recordPayment(c: MonthlyContract): Promise<void> {
    const period = this.period(c);
    const rate = getCommissionRate();
    await this.put(c.id, period, 'revenue', c.priceKz, 'settled', { paymentReference: c.paymentReference ?? null });
    await this.put(c.id, period, 'commission', c.priceKz * rate, 'settled', { rate });
  }

  /** Atribuicao: valor devido ao motorista = receita - comissao ja registada. Idempotente. */
  async recordDriverPayable(c: MonthlyContract): Promise<void> {
    await this.recordPayment(c); // cobre contratos pagos antes deste modulo existir
    const period = this.period(c);
    const comm = await this.entries.findOne({ where: { contractId: c.id, period, kind: 'commission' } });
    await this.put(c.id, period, 'driver_payable', c.priceKz - (comm?.amountKz ?? 0), 'pending', {
      driverId: c.driverId ?? null,
      vehicleId: c.vehicleId ?? null,
      fuelBorneByOperator: true,
    });
  }

﻿  /** Reembolso: lancamentos novos (nunca se apaga nada). Idempotente. */
  async recordRefund(c: MonthlyContract, refundKz: number): Promise<void> {
    await this.recordPayment(c); // cobre contratos pagos antes do ledger existir
    const period = this.period(c);
    const comm = await this.entries.findOne({ where: { contractId: c.id, period, kind: 'commission' } });
    const payable = await this.entries.findOne({ where: { contractId: c.id, period, kind: 'driver_payable' } });
    const rate = c.priceKz > 0 ? (comm?.amountKz ?? 0) / c.priceKz : 0;
    const commReversal = Math.round(refundKz * rate);
    await this.put(c.id, period, 'refund', refundKz, 'pending', { reason: 'cancelamento' });
    await this.put(c.id, period, 'commission_reversal', -commReversal, 'settled', { rate });
    if (payable) {
      const driverReversal = Math.min(refundKz - commReversal, payable.amountKz);
      await this.put(c.id, period, 'driver_reversal', -driverReversal, 'settled', {});
    }
  }

  /** Totais e margem por contrato. */
  async summary() {
    const rows: any[] = await this.entries.query(
      `SELECT l."contractId", u."fullName" AS "userFullName", c."priceKz", c.status,
              COALESCE(SUM(l."amountKz") FILTER (WHERE l.kind = 'revenue'), 0) AS revenue,
              COALESCE(SUM(l."amountKz") FILTER (WHERE l.kind IN ('commission', 'commission_reversal')), 0) AS commission,
              COALESCE(SUM(l."amountKz") FILTER (WHERE l.kind IN ('driver_payable', 'driver_reversal')), 0) AS "driverPayable",
              COALESCE(SUM(l."amountKz") FILTER (WHERE l.kind = 'refund'), 0) AS refunds
       FROM monthly_ledger_entries l
       JOIN monthly_contracts c ON c.id = l."contractId"
       LEFT JOIN users u ON u.id = c."userId"
       GROUP BY l."contractId", u."fullName", c."priceKz", c.status
       ORDER BY MAX(l."createdAt") DESC LIMIT 300`,
    );
    const contracts = rows.map((r) => ({
      contractId: r.contractId, userFullName: r.userFullName, status: r.status, priceKz: Number(r.priceKz),
      revenue: Number(r.revenue), commission: Number(r.commission), driverPayable: Number(r.driverPayable), refunds: Number(r.refunds),
    }));
    const sum = (k: 'revenue' | 'commission' | 'driverPayable' | 'refunds') => contracts.reduce((a, r) => a + r[k], 0);
    return {
      totals: { revenueKz: sum('revenue'), commissionKz: sum('commission'), driverPayableKz: sum('driverPayable'), refundsKz: sum('refunds') },
      contracts,
    };
  }

  list(contractId?: string) {
    if (contractId && !UUID_RE.test(contractId)) return Promise.resolve([]);
    return this.entries.find({
      where: contractId ? { contractId } : {},
      order: { createdAt: 'DESC' },
      take: 300,
    });
  }
}
