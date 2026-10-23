import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

const TRIP_SELECT = `
  SELECT t.id, t.status, t."priceKz", t."distanceKm", t."createdAt", t."paymentMethodType",
    COALESCE(NULLIF(t.origin->>'label',''), t.origin->>'address') AS "originLabel",
    COALESCE(NULLIF(t.destination->>'label',''), t.destination->>'address') AS "destinationLabel",
    u."fullName" AS "passengerName", d."fullName" AS "driverName"
  FROM trips t
  LEFT JOIN users u ON u.id = t."passengerId"
  LEFT JOIN drivers d ON d.id = t."driverId"`;

function likeTerm(q?: string): string | null {
  return q && q.trim() ? '%' + q.trim().replace(/[%_]/g, '') + '%' : null;
}

@Injectable()
export class AdminPeopleService {
  constructor(private readonly db: DataSource) {}

  async passengers(q?: string) {
    const rows = await this.db.query(
      `SELECT u.id, u."fullName", u.phone, u.email, u."createdAt",
         COALESCE(p."verificationStatus", 'none') AS "verificationStatus",
         COALESCE(p."angoPoints", 0) AS "angoPoints",
         (SELECT COUNT(*) FROM trips t WHERE t."passengerId" = u.id AND t.status::text = 'completed') AS "tripsCompleted",
         (SELECT COUNT(*) FROM trips t WHERE t."passengerId" = u.id AND t.status::text = 'cancelled') AS "tripsCancelled"
       FROM users u LEFT JOIN user_profiles p ON p."userId" = u.id
       WHERE ($1::text IS NULL OR u."fullName" ILIKE $1 OR u.phone ILIKE $1)
       ORDER BY u."createdAt" DESC LIMIT 200`,
      [likeTerm(q)],
    );
    return rows.map((r: any) => ({
      ...r,
      angoPoints: Number(r.angoPoints),
      tripsCompleted: Number(r.tripsCompleted),
      tripsCancelled: Number(r.tripsCancelled),
    }));
  }

  async passengerDetail(id: string) {
    const rows = await this.db.query(
      `SELECT u.id, u."fullName", u.phone, u.email, u."createdAt",
         COALESCE(p."verificationStatus", 'none') AS "verificationStatus",
         COALESCE(p."angoPoints", 0) AS "angoPoints"
       FROM users u LEFT JOIN user_profiles p ON p."userId" = u.id WHERE u.id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Passageiro nao encontrado.');

    const stats = await this.db.query(
      `SELECT COUNT(*) FILTER (WHERE status::text = 'completed') AS completed,
              COUNT(*) FILTER (WHERE status::text = 'cancelled') AS cancelled,
              COALESCE(SUM("priceKz") FILTER (WHERE status::text = 'completed'), 0) AS spent
       FROM trips WHERE "passengerId" = $1`,
      [id],
    );
    const trips = await this.db.query(TRIP_SELECT + ` WHERE t."passengerId" = $1 ORDER BY t."createdAt" DESC LIMIT 10`, [id]);

    let cancellations: unknown[] = [];
    try {
      cancellations = await this.db.query(
        `SELECT id, reason, risk, "createdAt" FROM cancellations WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 5`,
        [id],
      );
    } catch {
      cancellations = [];
    }

    return {
      passenger: { ...rows[0], angoPoints: Number(rows[0].angoPoints) },
      stats: {
        tripsCompleted: Number(stats[0]?.completed ?? 0),
        tripsCancelled: Number(stats[0]?.cancelled ?? 0),
        spentKz: Number(stats[0]?.spent ?? 0),
      },
      trips,
      cancellations,
    };
  }

  vehicles(q?: string) {
    return this.db.query(
      `SELECT v.id, v.model, v.plate, v.color, v."categoryId"::text AS "categoryId", v.capacity, v."createdAt", v.status, v."rejectionReason",
         v."driverId", d."fullName" AS "driverName", d.phone AS "driverPhone"
       FROM vehicles v LEFT JOIN drivers d ON d.id = v."driverId"
       WHERE ($1::text IS NULL OR v.plate ILIKE $1 OR v.model ILIKE $1 OR d."fullName" ILIKE $1)
       ORDER BY v."createdAt" DESC LIMIT 200`,
      [likeTerm(q)],
    );
  }

  private async vehicleOrFail(id: string): Promise<{ id: string; plate: string; driverId: string | null }> {
    const rows = await this.db.query(`SELECT id, plate, "driverId" FROM vehicles WHERE id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('Veiculo nao encontrado.');
    return rows[0];
  }

  async approveVehicle(id: string) {
    const v = await this.vehicleOrFail(id);
    await this.db.query(
      `UPDATE vehicles SET status = 'approved', "rejectionReason" = NULL, "reviewedAt" = now() WHERE id = $1`,
      [id],
    );
    return v;
  }

  async rejectVehicle(id: string, reason: string) {
    const v = await this.vehicleOrFail(id);
    await this.db.query(
      `UPDATE vehicles SET status = 'rejected', "rejectionReason" = $2, "reviewedAt" = now() WHERE id = $1`,
      [id, reason],
    );
    return v;
  }
}
