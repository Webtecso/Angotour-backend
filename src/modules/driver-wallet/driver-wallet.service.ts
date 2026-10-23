import { ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverWalletEntry } from './entities/driver-wallet-entry.entity';

/** Saldo minimo para receber corridas (documento de produto, seccao 9). */
export const MIN_OPERATING_BALANCE_KZ = 2000;

@Injectable()
export class DriverWalletService {
  constructor(
    @InjectRepository(DriverWalletEntry)
    private readonly entries: Repository<DriverWalletEntry>,
  ) {}

  async balances(driverId: string) {
    const rows: Array<{ kind: string; status: string; total: string }> = await this.entries.query(
      `SELECT kind, status, COALESCE(SUM("amountKz"),0) AS total FROM driver_wallet_entries WHERE "driverId" = $1 GROUP BY kind, status`,
      [driverId],
    );
    const sum = (kind: string, status: string) =>
      Number(rows.find((r) => r.kind === kind && r.status === status)?.total ?? 0);

    const balanceKz = sum('topup', 'confirmed') - sum('commission', 'settled');
    const reservedKz = sum('commission', 'reserved');
    return { balanceKz, reservedKz, availableKz: balanceKz - reservedKz };
  }

  /** Pode receber corridas: disponivel >= minimo operacional e >= comissao da corrida. */
  async canOperate(driverId: string, requiredKz = 0): Promise<boolean> {
    const { availableKz } = await this.balances(driverId);
    return availableKz >= Math.max(MIN_OPERATING_BALANCE_KZ, requiredKz);
  }

  async assertCanGoOnline(driverId: string): Promise<void> {
    const { availableKz } = await this.balances(driverId);
    if (availableKz < MIN_OPERATING_BALANCE_KZ) {
      throw new HttpException(
        `Carteira insuficiente. Saldo disponivel: ${availableKz} Kz; minimo necessario: ${MIN_OPERATING_BALANCE_KZ} Kz. Carrega a carteira para receber corridas.`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  /** Reserva a comissao ao aceitar. Idempotente. */
  async reserveCommission(driverId: string, tripId: string, amountKz: number): Promise<void> {
    const existing = await this.entries.findOne({ where: { driverId, tripId, kind: 'commission' } });
    if (existing) return;
    const { availableKz } = await this.balances(driverId);
    if (availableKz < amountKz) {
      throw new ForbiddenException('Saldo insuficiente para cobrir a comissao desta corrida. Carrega a carteira.');
    }
    await this.entries.save(this.entries.create({ driverId, tripId, kind: 'commission', amountKz, status: 'reserved' }));
  }

  /** Liquida a comissao ao concluir. Idempotente; cria a linha se a viagem nunca foi aceite pelo fluxo do motorista. */
  async settleCommission(driverId: string, tripId: string, amountKz: number): Promise<void> {
    const existing = await this.entries.findOne({ where: { driverId, tripId, kind: 'commission' } });
    if (!existing) {
      await this.entries.save(
        this.entries.create({ driverId, tripId, kind: 'commission', amountKz, status: 'settled', settledAt: new Date() }),
      );
      return;
    }
    if (existing.status === 'reserved') {
      existing.status = 'settled';
      existing.settledAt = new Date();
      await this.entries.save(existing);
    }
  }

  /** Liberta a reserva quando a viagem e cancelada. */
  async releaseCommission(driverId: string, tripId: string): Promise<void> {
    const existing = await this.entries.findOne({ where: { driverId, tripId, kind: 'commission' } });
    if (existing && existing.status === 'reserved') {
      existing.status = 'released';
      await this.entries.save(existing);
    }
  }

  async startTopUp(driverId: string, amountKz: number): Promise<DriverWalletEntry> {
    const reference = `9${Math.floor(10000000 + Math.random() * 89999999)}`;
    return this.entries.save(this.entries.create({ driverId, kind: 'topup', amountKz, status: 'processing', reference }));
  }

  /** SO DESENVOLVIMENTO: exige ALLOW_DEV_TOPUP_CONFIRM=true. Em producao vem de um webhook assinado. */
  async devConfirm(driverId: string, id: string): Promise<DriverWalletEntry> {
    if (process.env.ALLOW_DEV_TOPUP_CONFIRM !== 'true') throw new ForbiddenException();
    const entry = await this.entries.findOne({ where: { id, driverId, kind: 'topup' } });
    if (!entry) throw new NotFoundException('Deposito nao encontrado.');
    entry.status = 'confirmed';
    return this.entries.save(entry);
  }

  async summary(driverId: string) {
    const balances = await this.balances(driverId);
    const list = await this.entries.find({ where: { driverId }, order: { createdAt: 'DESC' }, take: 50 });

    let todayGrossKz = 0;
    let todayTrips = 0;
    let commissionsTodayKz = 0;
    try {
      const trips = await this.entries.query(
        `SELECT COALESCE(SUM("priceKz"),0) AS gross, COUNT(*) AS n FROM trips WHERE "driverId" = $1 AND status = 'completed' AND "completedAt" >= date_trunc('day', now())`,
        [driverId],
      );
      todayGrossKz = Number(trips[0]?.gross ?? 0);
      todayTrips = Number(trips[0]?.n ?? 0);
      const comm = await this.entries.query(
        `SELECT COALESCE(SUM("amountKz"),0) AS total FROM driver_wallet_entries WHERE "driverId" = $1 AND kind = 'commission' AND status = 'settled' AND "settledAt" >= date_trunc('day', now())`,
        [driverId],
      );
      commissionsTodayKz = Number(comm[0]?.total ?? 0);
    } catch {
      // estatisticas do dia nunca devem partir a carteira
    }

    return {
      ...balances,
      minimumOperatingBalanceKz: MIN_OPERATING_BALANCE_KZ,
      todayGrossKz,
      todayTrips,
      commissionsTodayKz,
      todayNetKz: todayGrossKz - commissionsTodayKz,
      entries: list.map((e) => ({
        id: e.id,
        kind: e.kind,
        status: e.status,
        amountKz: e.amountKz,
        reference: e.reference ?? null,
        tripId: e.tripId ?? null,
        createdAt: e.createdAt,
      })),
    };
  }
}
