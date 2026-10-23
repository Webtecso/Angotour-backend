import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DriverWalletService } from '../driver-wallet/driver-wallet.service';

@Injectable()
export class AdminFinanceService {
  constructor(
    private readonly db: DataSource,
    private readonly wallet: DriverWalletService,
  ) {}

  async overview() {
    const balance = await this.db.query(
      `SELECT COALESCE(SUM(CASE WHEN kind='topup' AND status='confirmed' THEN "amountKz" WHEN kind='commission' AND status='settled' THEN -"amountKz" ELSE 0 END),0) AS total FROM driver_wallet_entries`,
    );
    const reserved = await this.db.query(
      `SELECT COALESCE(SUM("amountKz"),0) AS total FROM driver_wallet_entries WHERE kind='commission' AND status='reserved'`,
    );
    const pending = await this.db.query(
      `SELECT COALESCE(SUM("amountKz"),0) AS total, COUNT(*) AS n FROM driver_wallet_entries WHERE kind='topup' AND status='processing'`,
    );
    const commissionsToday = await this.db.query(
      `SELECT COALESCE(SUM("amountKz"),0) AS total FROM driver_wallet_entries WHERE kind='commission' AND status='settled' AND "settledAt" >= date_trunc('day', now())`,
    );
    const tripsToday = await this.db.query(
      `SELECT COALESCE(SUM("priceKz"),0) AS volume, COUNT(*) AS n FROM trips WHERE status::text='completed' AND "completedAt" >= date_trunc('day', now())`,
    );

    const totalBalanceKz = Number(balance[0]?.total ?? 0);
    const totalReservedKz = Number(reserved[0]?.total ?? 0);
    return {
      totalBalanceKz, totalReservedKz, totalAvailableKz: totalBalanceKz - totalReservedKz,
      pendingTopupsKz: Number(pending[0]?.total ?? 0), pendingTopupsCount: Number(pending[0]?.n ?? 0),
      commissionsTodayKz: Number(commissionsToday[0]?.total ?? 0),
      volumeTodayKz: Number(tripsToday[0]?.volume ?? 0), tripsToday: Number(tripsToday[0]?.n ?? 0),
    };
  }

  async wallets(q?: string) {
    const term = q && q.trim() ? '%' + q.trim().replace(/[%_]/g, '') + '%' : null;
    const rows = await this.db.query(
      `SELECT d.id, d."fullName", d.phone, d.status,
         COALESCE(SUM(CASE WHEN e.kind='topup' AND e.status='confirmed' THEN e."amountKz" WHEN e.kind='commission' AND e.status='settled' THEN -e."amountKz" ELSE 0 END),0) AS "balanceKz",
         COALESCE(SUM(CASE WHEN e.kind='commission' AND e.status='reserved' THEN e."amountKz" ELSE 0 END),0) AS "reservedKz"
       FROM drivers d
       LEFT JOIN driver_wallet_entries e ON e."driverId" = d.id
       WHERE ($1::text IS NULL OR d."fullName" ILIKE $1 OR d.phone ILIKE $1)
       GROUP BY d.id, d."fullName", d.phone, d.status
       ORDER BY d."fullName" ASC LIMIT 200`,
      [term],
    );
    return rows.map((r: any) => {
      const balanceKz = Number(r.balanceKz);
      const reservedKz = Number(r.reservedKz);
      return { id: r.id, fullName: r.fullName, phone: r.phone, status: r.status, balanceKz, reservedKz, availableKz: balanceKz - reservedKz };
    });
  }

  async walletDetail(driverId: string) {
    const rows = await this.db.query(`SELECT id, "fullName", phone, status FROM drivers WHERE id = $1`, [driverId]);
    if (!rows[0]) throw new NotFoundException('Motorista nao encontrado.');
    const summary = await this.wallet.summary(driverId);
    return { driver: rows[0], ...summary };
  }
}
