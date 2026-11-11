import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DriverProfileService {
  constructor(private readonly db: DataSource) {}

  async me(driverId: string) {
    const rows = await this.db.query(
      `SELECT id, "fullName", phone, rating, status, "isVerified", "createdAt" FROM drivers WHERE id = $1`,
      [driverId],
    );
    if (!rows[0]) throw new NotFoundException('Motorista nao encontrado.');
    const stats = await this.db.query(
      `SELECT COUNT(*) FILTER (WHERE status::text = 'completed') AS completed,
              COUNT(*) FILTER (WHERE status::text = 'cancelled') AS cancelled
       FROM trips WHERE "driverId" = $1`,
      [driverId],
    );
    const r = rows[0];
    return {
      id: r.id,
      fullName: r.fullName,
      phone: r.phone,
      rating: Number(r.rating ?? 0),
      status: r.status,
      isVerified: !!r.isVerified,
      memberSince: r.createdAt,
      tripsCompleted: Number(stats[0]?.completed ?? 0),
      tripsCancelled: Number(stats[0]?.cancelled ?? 0),
    };
  }

  /** Ganhos brutos, comissao e liquido por periodo (hoje, semana, mes). */
  async earnings(driverId: string) {
    const rows = await this.db.query(
      `SELECT
         p.period,
         COALESCE(SUM(t."priceKz"), 0) AS gross,
         COUNT(t.id) AS trips
       FROM (VALUES ('today', date_trunc('day', now())),
                    ('week',  date_trunc('week', now())),
                    ('month', date_trunc('month', now()))) AS p(period, since)
       LEFT JOIN trips t ON t."driverId" = $1 AND t.status::text = 'completed' AND t."completedAt" >= p.since
       GROUP BY p.period`,
      [driverId],
    );
    const comm = await this.db.query(
      `SELECT p.period, COALESCE(SUM(e."amountKz"), 0) AS commission
       FROM (VALUES ('today', date_trunc('day', now())),
                    ('week',  date_trunc('week', now())),
                    ('month', date_trunc('month', now()))) AS p(period, since)
       LEFT JOIN driver_wallet_entries e ON e."driverId" = $1 AND e.kind = 'commission' AND e.status = 'settled' AND e."settledAt" >= p.since
       GROUP BY p.period`,
      [driverId],
    );
    const out: Record<string, { grossKz: number; commissionKz: number; netKz: number; trips: number }> = {};
    for (const r of rows) {
      const c = Number(comm.find((x: any) => x.period === r.period)?.commission ?? 0);
      const g = Number(r.gross);
      out[r.period] = { grossKz: g, commissionKz: c, netKz: g - c, trips: Number(r.trips) };
    }
    return out;
  }

  /** Ultimas 50 viagens do motorista (concluidas ou canceladas). */
  async history(driverId: string) {
    return this.db.query(
      `SELECT t.id, t.status, t."priceKz", t."distanceKm", t."createdAt", t."completedAt",
              COALESCE(NULLIF(t.origin->>'label',''), t.origin->>'address') AS "originLabel",
              COALESCE(NULLIF(t.destination->>'label',''), t.destination->>'address') AS "destinationLabel"
       FROM trips t
       WHERE t."driverId" = $1 AND t.status::text IN ('completed','cancelled')
       ORDER BY COALESCE(t."completedAt", t."createdAt") DESC LIMIT 50`,
      [driverId],
    );
  }
}
