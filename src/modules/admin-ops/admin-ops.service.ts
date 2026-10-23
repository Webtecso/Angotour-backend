import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DriverWalletService } from '../driver-wallet/driver-wallet.service';
import { REQUIRED_DRIVER_DOCUMENTS } from '../driver-documents/entities/driver-document.entity';

const DRIVER_STATUSES = ['online', 'offline', 'on_trip'];
const TRIP_STATUSES = ['searching_driver', 'driver_assigned', 'driver_arriving', 'in_progress', 'completed', 'cancelled'];
const DOC_STATUSES = ['pending', 'approved', 'rejected'];
const INCIDENT_KINDS = ['incident', 'lost_item'];
const INCIDENT_STATUSES = ['recebido', 'analise_automatica', 'em_investigacao', 'decisao', 'resolvido'];

const TRIP_SELECT = `
  SELECT t.id, t.status, t."priceKz", t."distanceKm", t."createdAt", t."paymentMethodType",
    COALESCE(NULLIF(t.origin->>'label',''), t.origin->>'address') AS "originLabel",
    COALESCE(NULLIF(t.destination->>'label',''), t.destination->>'address') AS "destinationLabel",
    u."fullName" AS "passengerName", d."fullName" AS "driverName"
  FROM trips t
  LEFT JOIN users u ON u.id = t."passengerId"
  LEFT JOIN drivers d ON d.id = t."driverId"`;

@Injectable()
export class AdminOpsService {
  constructor(
    private readonly db: DataSource,
    private readonly wallet: DriverWalletService,
  ) {}

  private async scalar(sql: string, params: any[] = []): Promise<number> {
    try {
      const rows = await this.db.query(sql, params);
      const v = rows?.[0] ? Object.values(rows[0])[0] : 0;
      return Number(v ?? 0);
    } catch {
      return 0;
    }
  }

  private async count(sql: string): Promise<number | null> {
    try {
      const r = await this.db.query(sql);
      return Number(r[0]?.n ?? 0);
    } catch {
      return null;
    }
  }

  async dashboard() {
    const [drivers, online, onTrip, passengers, tripsToday, tripsActive, volumeToday, commissionsToday, pendingDocs] = await Promise.all([
      this.count(`SELECT COUNT(*) AS n FROM drivers`),
      this.count(`SELECT COUNT(*) AS n FROM drivers WHERE status::text = 'online'`),
      this.count(`SELECT COUNT(*) AS n FROM drivers WHERE status::text = 'on_trip'`),
      this.count(`SELECT COUNT(*) AS n FROM users`),
      this.count(`SELECT COUNT(*) AS n FROM trips WHERE "createdAt" >= date_trunc('day', now())`),
      this.count(`SELECT COUNT(*) AS n FROM trips WHERE status::text IN ('driver_assigned','driver_arriving','in_progress')`),
      this.count(`SELECT COALESCE(SUM("priceKz"),0) AS n FROM trips WHERE status::text = 'completed' AND "completedAt" >= date_trunc('day', now())`),
      this.count(`SELECT COALESCE(SUM("amountKz"),0) AS n FROM driver_wallet_entries WHERE kind = 'commission' AND status = 'settled' AND "settledAt" >= date_trunc('day', now())`),
      this.count(`SELECT COUNT(*) AS n FROM driver_documents WHERE status = 'pending'`),
    ]);
    return { drivers, online, onTrip, passengers, tripsToday, tripsActive, volumeToday, commissionsToday, pendingDocs };
  }

  async drivers(filters: { status?: string; verified?: string; q?: string }) {
    const status = filters.status && DRIVER_STATUSES.includes(filters.status) ? filters.status : null;
    const verified = filters.verified === 'yes' ? true : filters.verified === 'no' ? false : null;
    const term = filters.q && filters.q.trim() ? '%' + filters.q.trim().replace(/[%_]/g, '') + '%' : null;

    const rows = await this.db.query(
      `SELECT d.id, d."fullName", d.phone, d.rating, d.status, d."isVerified", d."createdAt",
         (SELECT COUNT(*) FROM trips t WHERE t."driverId" = d.id AND t.status::text = 'completed') AS "tripsCompleted",
         (SELECT COUNT(*) FROM driver_documents x WHERE x."driverId" = d.id AND x.status = 'approved') AS "docsApproved"
       FROM drivers d
       WHERE ($1::text IS NULL OR d.status::text = $1)
         AND ($2::boolean IS NULL OR d."isVerified" = $2)
         AND ($3::text IS NULL OR d."fullName" ILIKE $3 OR d.phone ILIKE $3)
       ORDER BY d."createdAt" DESC LIMIT 200`,
      [status, verified, term],
    );
    return rows.map((r: any) => ({
      ...r,
      tripsCompleted: Number(r.tripsCompleted),
      docsApproved: Number(r.docsApproved),
      docsRequired: REQUIRED_DRIVER_DOCUMENTS.length,
    }));
  }

  async driverDetail(id: string) {
    const rows = await this.db.query(
      `SELECT id, "fullName", phone, rating, status, "isVerified", gender, "createdAt",
         ST_Y("currentLocation"::geometry) AS lat, ST_X("currentLocation"::geometry) AS lng
       FROM drivers WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Motorista nao encontrado.');
    const r = rows[0];

    const docs = await this.db.query(
      `SELECT id, type, status, "rejectionReason", "updatedAt" FROM driver_documents WHERE "driverId" = $1`,
      [id],
    );
    const documents = REQUIRED_DRIVER_DOCUMENTS.map((type) => {
      const d = docs.find((x: any) => x.type === type);
      return d
        ? { id: d.id, type, status: d.status, rejectionReason: d.rejectionReason, updatedAt: d.updatedAt }
        : { id: null, type, status: 'not_submitted', rejectionReason: null, updatedAt: null };
    });

    const stats = await this.db.query(
      `SELECT COUNT(*) FILTER (WHERE status::text = 'completed') AS completed, COUNT(*) FILTER (WHERE status::text = 'cancelled') AS cancelled FROM trips WHERE "driverId" = $1`,
      [id],
    );
    const trips = await this.db.query(TRIP_SELECT + ` WHERE t."driverId" = $1 ORDER BY t."createdAt" DESC LIMIT 10`, [id]);
    const wallet = await this.wallet.balances(id);

    return {
      driver: {
        id: r.id, fullName: r.fullName, phone: r.phone, rating: r.rating, status: r.status,
        isVerified: r.isVerified, gender: r.gender, createdAt: r.createdAt,
        lat: r.lat == null ? null : Number(r.lat), lng: r.lng == null ? null : Number(r.lng),
      },
      stats: { tripsCompleted: Number(stats[0]?.completed ?? 0), tripsCancelled: Number(stats[0]?.cancelled ?? 0) },
      documents,
      wallet,
      trips,
    };
  }

  /** status: pending (por omissao) | approved | rejected | all */
  documents(status?: string) {
    const s = status === 'all' ? null : status && DOC_STATUSES.includes(status) ? status : 'pending';
    return this.db.query(
      `SELECT d.id, d."driverId", d.type, d.status, d."rejectionReason", d."createdAt", d."updatedAt", dr."fullName", dr.phone
       FROM driver_documents d JOIN drivers dr ON dr.id = d."driverId"
       WHERE ($1::text IS NULL OR d.status = $1)
       ORDER BY d."updatedAt" ASC LIMIT 300`,
      [s],
    );
  }

  async documentInfo(id: string): Promise<{ driverId: string; type: string }> {
    const rows = await this.db.query(`SELECT "driverId", type FROM driver_documents WHERE id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('Documento nao encontrado.');
    return rows[0];
  }

  /** Mapa operacional: motoristas com localizacao conhecida (seccao 5 do documento). */
  async mapDrivers(status?: string) {
    const s = status && DRIVER_STATUSES.includes(status) ? status : null;
    const rows = await this.db.query(
      `SELECT id, "fullName", phone, rating, status, gender,
         ST_Y("currentLocation"::geometry) AS lat, ST_X("currentLocation"::geometry) AS lng
       FROM drivers
       WHERE "currentLocation" IS NOT NULL
         AND ($1::text IS NULL OR status::text = $1)
       ORDER BY "fullName" ASC LIMIT 500`,
      [s],
    );
    return rows.map((r: any) => ({ ...r, lat: Number(r.lat), lng: Number(r.lng) }));
  }

  /** Central de Seguranca / Suporte: incidentes (SOS, suspeitas) e objetos perdidos. */
  async incidents(filters: { kind?: string; status?: string }) {
    const kind = filters.kind && INCIDENT_KINDS.includes(filters.kind) ? filters.kind : null;
    const status = filters.status && INCIDENT_STATUSES.includes(filters.status) ? filters.status : null;
    return this.db.query(
      `SELECT i.id, i."caseNumber", i.kind, i.category, i.description, i."tripRef", i.status, i."createdAt",
              u."fullName" AS "userFullName", u.phone AS "userPhone"
       FROM incidents i
       LEFT JOIN users u ON u.id = i."userId"
       WHERE ($1::text IS NULL OR i.kind = $1)
         AND ($2::text IS NULL OR i.status = $2)
       ORDER BY i."createdAt" DESC LIMIT 300`,
      [kind, status],
    );
  }

  async incidentInfo(id: string): Promise<{ id: string; caseNumber: string; kind: string }> {
    const rows = await this.db.query(`SELECT id, "caseNumber", kind FROM incidents WHERE id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('Caso nao encontrado.');
    return rows[0];
  }

  async updateIncidentStatus(id: string, status: string): Promise<{ ok: boolean; status: string }> {
    if (!INCIDENT_STATUSES.includes(status)) throw new BadRequestException('Estado invalido.');
    const rows = await this.db.query(`UPDATE incidents SET status = $1 WHERE id = $2 RETURNING id`, [status, id]);
    if (rows.length === 0) throw new NotFoundException('Caso nao encontrado.');
    return { ok: true, status };
  }

  /** Passageiros: lista com estado de verificacao e contagem de viagens. */
  async passengers(filters: { q?: string }) {
    const q = filters.q ? `%${filters.q}%` : null;
    const rows = await this.db.query(
      `SELECT u.id, u."fullName", u.phone, u.email, u."angoPoints", u."createdAt",
         CASE WHEN u."isVerified" THEN 'verified' ELSE 'none' END AS "verificationStatus",
         COALESCE(t.trips_completed, 0) AS "tripsCompleted",
         COALESCE(t.trips_cancelled, 0) AS "tripsCancelled"
       FROM users u
       LEFT JOIN (
         SELECT "passengerId",
           COUNT(*) FILTER (WHERE status = 'completed') AS trips_completed,
           COUNT(*) FILTER (WHERE status = 'cancelled') AS trips_cancelled
         FROM trips GROUP BY "passengerId"
       ) t ON t."passengerId" = u.id
       WHERE ($1::text IS NULL OR u."fullName" ILIKE $1 OR u.phone ILIKE $1)
       ORDER BY u."createdAt" DESC LIMIT 300`,
      [q],
    );
    return rows.map((r: any) => ({
      ...r,
      tripsCompleted: Number(r.tripsCompleted),
      tripsCancelled: Number(r.tripsCancelled),
    }));
  }

  async passengerDetail(id: string) {
    const rows = await this.db.query(
      `SELECT id, "fullName", phone, email, "angoPoints", "createdAt",
         CASE WHEN "isVerified" THEN 'verified' ELSE 'none' END AS "verificationStatus"
       FROM users WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Passageiro nao encontrado.');
    const stats = await this.db.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'completed') AS completed,
              COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
              COALESCE(SUM(CASE WHEN status = 'completed' THEN "priceKz" ELSE 0 END), 0) AS spent
       FROM trips WHERE "passengerId" = $1`,
      [id],
    );
    const trips = await this.db.query(`${TRIP_SELECT} WHERE t."passengerId" = $1 ORDER BY t."createdAt" DESC LIMIT 20`, [id]);

    // Cancelamentos recentes com avaliacao de risco: conta quantos cancelamentos o mesmo
    // passageiro fez nos 7 dias antes de cada um. 2+ = a monitorizar; 5+ = suspeito.
    const cancelRows = await this.db.query(
      `SELECT t.id, COALESCE(NULLIF(t."cancelReason", ''), 'Sem motivo indicado') AS reason, t."createdAt",
         (SELECT COUNT(*) FROM trips t2
            WHERE t2."passengerId" = t."passengerId" AND t2.status = 'cancelled'
              AND t2."createdAt" <= t."createdAt" AND t2."createdAt" > t."createdAt" - interval '7 days') AS "recentCount"
       FROM trips t
       WHERE t."passengerId" = $1 AND t.status = 'cancelled'
       ORDER BY t."createdAt" DESC LIMIT 10`,
      [id],
    );
    const cancellations = cancelRows.map((r: any) => {
      const n = Number(r.recentCount);
      const risk = n >= 5 ? 'suspeito' : n >= 2 ? 'monitorizar' : 'legitimo';
      return { id: r.id, reason: r.reason, risk, createdAt: r.createdAt };
    });

    return {
      passenger: rows[0],
      stats: {
        tripsCompleted: Number(stats[0]?.completed ?? 0),
        tripsCancelled: Number(stats[0]?.cancelled ?? 0),
        spentKz: Number(stats[0]?.spent ?? 0),
      },
      trips,
      cancellations,
    };
  }

  /** Veiculos: lista com o motorista associado e o estado de aprovacao. */
  async vehicles(filters: { q?: string }) {
    const q = filters.q ? `%${filters.q}%` : null;
    return this.db.query(
      `SELECT v.id, v.model, v.plate, v.color, v."categoryId", v.capacity, v.status, v."rejectionReason", v."createdAt",
         d.id AS "driverId", d."fullName" AS "driverName", d.phone AS "driverPhone"
       FROM vehicles v
       LEFT JOIN drivers d ON d.id = v."driverId"
       WHERE ($1::text IS NULL OR v.plate ILIKE $1 OR v.model ILIKE $1 OR d."fullName" ILIKE $1)
       ORDER BY v."createdAt" DESC LIMIT 300`,
      [q],
    );
  }

  async vehicleInfo(id: string): Promise<{ id: string; plate: string; driverId: string | null }> {
    const rows = await this.db.query(`SELECT id, plate, "driverId" FROM vehicles WHERE id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('Veiculo nao encontrado.');
    return rows[0];
  }

  async approveVehicle(id: string): Promise<{ ok: boolean }> {
    const rows = await this.db.query(
      `UPDATE vehicles SET status = 'approved', "rejectionReason" = NULL, "reviewedAt" = now() WHERE id = $1 RETURNING id`,
      [id],
    );
    if (rows.length === 0) throw new NotFoundException('Veiculo nao encontrado.');
    return { ok: true };
  }

  async rejectVehicle(id: string, reason: string): Promise<{ ok: boolean }> {
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException('Motivo da rejeicao e obrigatorio (minimo 3 caracteres).');
    }
    const rows = await this.db.query(
      `UPDATE vehicles SET status = 'rejected', "rejectionReason" = $1, "reviewedAt" = now() WHERE id = $2 RETURNING id`,
      [reason.trim(), id],
    );
    if (rows.length === 0) throw new NotFoundException('Veiculo nao encontrado.');
    return { ok: true };
  }

  /** Financeiro: visao geral da plataforma (seccao 9/financeiro do documento). */
  async financeOverview() {
    const rows: Array<{ kind: string; status: string; total: string }> = await this.db.query(
      `SELECT kind, status, COALESCE(SUM("amountKz"),0) AS total FROM driver_wallet_entries GROUP BY kind, status`,
    );
    const sum = (kind: string, status: string) =>
      Number(rows.find((r) => r.kind === kind && r.status === status)?.total ?? 0);

    const totalBalanceKz = sum('topup', 'confirmed') - sum('commission', 'settled');
    const totalReservedKz = sum('commission', 'reserved');
    const pendingTopupsKz = sum('topup', 'processing');

    const pendingTopupsCount = await this.scalar(
      `SELECT COUNT(*) FROM driver_wallet_entries WHERE kind = 'topup' AND status = 'processing'`,
    );
    const commissionsTodayKz = await this.scalar(
      `SELECT COALESCE(SUM("amountKz"),0) FROM driver_wallet_entries WHERE kind = 'commission' AND status = 'settled' AND "settledAt" >= date_trunc('day', now())`,
    );
    const volumeTodayKz = await this.scalar(
      `SELECT COALESCE(SUM("priceKz"),0) FROM trips WHERE status = 'completed' AND "completedAt" >= date_trunc('day', now())`,
    );
    const tripsToday = await this.scalar(
      `SELECT COUNT(*) FROM trips WHERE status = 'completed' AND "completedAt" >= date_trunc('day', now())`,
    );

    return {
      totalBalanceKz,
      totalReservedKz,
      totalAvailableKz: totalBalanceKz - totalReservedKz,
      pendingTopupsKz,
      pendingTopupsCount,
      commissionsTodayKz,
      volumeTodayKz,
      tripsToday,
    };
  }

  /** Financeiro: carteiras de todos os motoristas com saldo/reservado/disponivel. */
  async wallets(filters: { q?: string }) {
    const q = filters.q ? `%${filters.q}%` : null;
    const rows = await this.db.query(
      `SELECT d.id, d."fullName", d.phone, d.status,
         COALESCE(t.topup_confirmed,0) AS topup_confirmed,
         COALESCE(c.commission_settled,0) AS commission_settled,
         COALESCE(c.commission_reserved,0) AS commission_reserved
       FROM drivers d
       LEFT JOIN (
         SELECT "driverId", SUM("amountKz") AS topup_confirmed
         FROM driver_wallet_entries WHERE kind = 'topup' AND status = 'confirmed' GROUP BY "driverId"
       ) t ON t."driverId" = d.id
       LEFT JOIN (
         SELECT "driverId",
           SUM(CASE WHEN status = 'settled' THEN "amountKz" ELSE 0 END) AS commission_settled,
           SUM(CASE WHEN status = 'reserved' THEN "amountKz" ELSE 0 END) AS commission_reserved
         FROM driver_wallet_entries WHERE kind = 'commission' GROUP BY "driverId"
       ) c ON c."driverId" = d.id
       WHERE ($1::text IS NULL OR d."fullName" ILIKE $1 OR d.phone ILIKE $1)
       ORDER BY d."fullName" ASC LIMIT 300`,
      [q],
    );
    return rows.map((r: any) => {
      const balanceKz = Number(r.topup_confirmed) - Number(r.commission_settled);
      const reservedKz = Number(r.commission_reserved);
      return {
        id: r.id, fullName: r.fullName, phone: r.phone, status: r.status,
        balanceKz, reservedKz, availableKz: balanceKz - reservedKz,
      };
    });
  }

  /** Financeiro: extrato detalhado de um motorista (reaproveita o DriverWalletService). */
  async walletDetail(driverId: string) {
    const driver = await this.db.query(`SELECT id, "fullName", phone, status FROM drivers WHERE id = $1`, [driverId]);
    if (!driver[0]) throw new NotFoundException('Motorista nao encontrado.');
    const summary = await this.wallet.summary(driverId);
    return { driver: driver[0], ...summary };
  }

  // ---------------- Agentes ----------------
  async agents(filters: { q?: string }) {
    const q = filters.q ? `%${filters.q}%` : null;
    const rows = await this.db.query(
      `SELECT a.id, a."fullName", a.phone, a.email, a."referralCode", a."commissionPercent", a.status, a."createdAt",
         COALESCE(d.driver_count, 0) AS "driverCount"
       FROM agents a
       LEFT JOIN (SELECT "agentId", COUNT(*) AS driver_count FROM agent_drivers GROUP BY "agentId") d ON d."agentId" = a.id
       WHERE ($1::text IS NULL OR a."fullName" ILIKE $1 OR a.phone ILIKE $1 OR a."referralCode" ILIKE $1)
       ORDER BY a."createdAt" DESC LIMIT 300`,
      [q],
    );
    return rows.map((r: any) => ({ ...r, driverCount: Number(r.driverCount) }));
  }

  async createAgent(dto: { fullName: string; phone: string; email?: string; commissionPercent?: number }) {
    if (!dto.fullName?.trim() || !dto.phone?.trim()) throw new BadRequestException('Nome e telefone sao obrigatorios.');
    const code = 'AG-' + Math.floor(100000 + Math.random() * 900000);
    const rows = await this.db.query(
      `INSERT INTO agents ("fullName", phone, email, "referralCode", "commissionPercent", status)
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id`,
      [dto.fullName.trim(), dto.phone.trim(), dto.email?.trim() || null, code, dto.commissionPercent ?? 10],
    );
    return { id: rows[0].id, referralCode: code };
  }

  async agentDetail(id: string) {
    const rows = await this.db.query(
      `SELECT id, "fullName", phone, email, "referralCode", "commissionPercent", status, "createdAt" FROM agents WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Agente nao encontrado.');

    const drivers = await this.db.query(
      `SELECT d.id, d."fullName", d.phone, d.status, d.rating, COALESCE(w.settled, 0) AS "commissionSettledKz"
       FROM agent_drivers ad
       JOIN drivers d ON d.id = ad."driverId"
       LEFT JOIN (
         SELECT "driverId", SUM("amountKz") AS settled FROM driver_wallet_entries
         WHERE kind = 'commission' AND status = 'settled' GROUP BY "driverId"
       ) w ON w."driverId" = d.id
       WHERE ad."agentId" = $1 ORDER BY d."fullName" ASC`,
      [id],
    );

    const pct = Number(rows[0].commissionPercent) / 100;
    const driversOut = drivers.map((d: any) => {
      const driverCommissionKz = Number(d.commissionSettledKz ?? 0);
      return { ...d, driverCommissionKz, agentEarningsKz: Math.round(driverCommissionKz * pct) };
    });
    const totalEarningsKz = driversOut.reduce((s: number, d: any) => s + d.agentEarningsKz, 0);

    return { agent: rows[0], drivers: driversOut, totalEarningsKz };
  }

  async assignDriverToAgent(agentId: string, driverId: string) {
    const agent = await this.db.query(`SELECT id FROM agents WHERE id = $1`, [agentId]);
    if (!agent[0]) throw new NotFoundException('Agente nao encontrado.');
    const driver = await this.db.query(`SELECT id, "fullName" FROM drivers WHERE id = $1`, [driverId]);
    if (!driver[0]) throw new NotFoundException('Motorista nao encontrado.');
    await this.db.query(
      `INSERT INTO agent_drivers ("agentId", "driverId") VALUES ($1, $2)
       ON CONFLICT ("driverId") DO UPDATE SET "agentId" = EXCLUDED."agentId"`,
      [agentId, driverId],
    );
    return { ok: true, driverName: driver[0].fullName };
  }

  async unassignDriverFromAgent(agentId: string, driverId: string) {
    await this.db.query(`DELETE FROM agent_drivers WHERE "agentId" = $1 AND "driverId" = $2`, [agentId, driverId]);
    return { ok: true };
  }

  // ---------------- Proprietarios e Frotas ----------------
  async owners(filters: { q?: string }) {
    const q = filters.q ? `%${filters.q}%` : null;
    const rows = await this.db.query(
      `SELECT o.id, o."fullName", o.phone, o.email, o."createdAt",
         COALESCE(f.fleet_count, 0) AS "fleetCount", COALESCE(v.vehicle_count, 0) AS "vehicleCount"
       FROM owners o
       LEFT JOIN (SELECT "ownerId", COUNT(*) AS fleet_count FROM fleets GROUP BY "ownerId") f ON f."ownerId" = o.id
       LEFT JOIN (
         SELECT fl."ownerId", COUNT(*) AS vehicle_count FROM fleet_vehicles fv JOIN fleets fl ON fl.id = fv."fleetId" GROUP BY fl."ownerId"
       ) v ON v."ownerId" = o.id
       WHERE ($1::text IS NULL OR o."fullName" ILIKE $1 OR o.phone ILIKE $1)
       ORDER BY o."createdAt" DESC LIMIT 300`,
      [q],
    );
    return rows.map((r: any) => ({ ...r, fleetCount: Number(r.fleetCount), vehicleCount: Number(r.vehicleCount) }));
  }

  async createOwner(dto: { fullName: string; phone: string; email?: string }) {
    if (!dto.fullName?.trim() || !dto.phone?.trim()) throw new BadRequestException('Nome e telefone sao obrigatorios.');
    const owner = await this.db.query(`INSERT INTO owners ("fullName", phone, email) VALUES ($1, $2, $3) RETURNING id`, [
      dto.fullName.trim(), dto.phone.trim(), dto.email?.trim() || null,
    ]);
    const ownerId = owner[0].id;
    const fleet = await this.db.query(`INSERT INTO fleets ("ownerId", name) VALUES ($1, 'Frota principal') RETURNING id`, [ownerId]);
    return { id: ownerId, defaultFleetId: fleet[0].id };
  }

  async ownerDetail(id: string) {
    const rows = await this.db.query(`SELECT id, "fullName", phone, email, "createdAt" FROM owners WHERE id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('Proprietario nao encontrado.');

    const fleets = await this.db.query(
      `SELECT fl.id, fl.name, fl."createdAt", COALESCE(vc.n, 0) AS "vehicleCount"
       FROM fleets fl LEFT JOIN (SELECT "fleetId", COUNT(*) AS n FROM fleet_vehicles GROUP BY "fleetId") vc ON vc."fleetId" = fl.id
       WHERE fl."ownerId" = $1 ORDER BY fl."createdAt" ASC`,
      [id],
    );
    const vehicles = await this.db.query(
      `SELECT v.id, v.plate, v.model, v.color, v.status AS "vehicleStatus", fl.name AS "fleetName",
         d.id AS "driverId", d."fullName" AS "driverName", d.status AS "driverStatus"
       FROM fleet_vehicles fv JOIN fleets fl ON fl.id = fv."fleetId" JOIN vehicles v ON v.id = fv."vehicleId"
       LEFT JOIN drivers d ON d.id = v."driverId"
       WHERE fl."ownerId" = $1 ORDER BY v."createdAt" DESC`,
      [id],
    );
    return { owner: rows[0], fleets: fleets.map((f: any) => ({ ...f, vehicleCount: Number(f.vehicleCount) })), vehicles };
  }

  async fleets(filters: { q?: string }) {
    const q = filters.q ? `%${filters.q}%` : null;
    const rows = await this.db.query(
      `SELECT fl.id, fl.name, fl."createdAt", o.id AS "ownerId", o."fullName" AS "ownerName", o.phone AS "ownerPhone",
         COALESCE(vc.n, 0) AS "vehicleCount"
       FROM fleets fl JOIN owners o ON o.id = fl."ownerId"
       LEFT JOIN (SELECT "fleetId", COUNT(*) AS n FROM fleet_vehicles GROUP BY "fleetId") vc ON vc."fleetId" = fl.id
       WHERE ($1::text IS NULL OR fl.name ILIKE $1 OR o."fullName" ILIKE $1)
       ORDER BY fl."createdAt" DESC LIMIT 300`,
      [q],
    );
    return rows.map((r: any) => ({ ...r, vehicleCount: Number(r.vehicleCount) }));
  }

  async createFleet(dto: { ownerId: string; name: string }) {
    if (!dto.ownerId || !dto.name?.trim()) throw new BadRequestException('Proprietario e nome sao obrigatorios.');
    const owner = await this.db.query(`SELECT id FROM owners WHERE id = $1`, [dto.ownerId]);
    if (!owner[0]) throw new NotFoundException('Proprietario nao encontrado.');
    const rows = await this.db.query(`INSERT INTO fleets ("ownerId", name) VALUES ($1, $2) RETURNING id`, [dto.ownerId, dto.name.trim()]);
    return { id: rows[0].id };
  }

  async fleetDetail(id: string) {
    const rows = await this.db.query(
      `SELECT fl.id, fl.name, fl."createdAt", o.id AS "ownerId", o."fullName" AS "ownerName"
       FROM fleets fl JOIN owners o ON o.id = fl."ownerId" WHERE fl.id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Frota nao encontrada.');
    const vehicles = await this.db.query(
      `SELECT v.id, v.plate, v.model, v.color, v.status AS "vehicleStatus",
         d.id AS "driverId", d."fullName" AS "driverName", d.status AS "driverStatus"
       FROM fleet_vehicles fv JOIN vehicles v ON v.id = fv."vehicleId" LEFT JOIN drivers d ON d.id = v."driverId"
       WHERE fv."fleetId" = $1 ORDER BY v."createdAt" DESC`,
      [id],
    );
    return { fleet: rows[0], vehicles };
  }

  async assignVehicleToFleet(fleetId: string, vehicleId: string) {
    const fleet = await this.db.query(`SELECT id FROM fleets WHERE id = $1`, [fleetId]);
    if (!fleet[0]) throw new NotFoundException('Frota nao encontrada.');
    const vehicle = await this.db.query(`SELECT id, plate FROM vehicles WHERE id = $1`, [vehicleId]);
    if (!vehicle[0]) throw new NotFoundException('Veiculo nao encontrado.');
    await this.db.query(
      `INSERT INTO fleet_vehicles ("fleetId", "vehicleId") VALUES ($1, $2)
       ON CONFLICT ("vehicleId") DO UPDATE SET "fleetId" = EXCLUDED."fleetId"`,
      [fleetId, vehicleId],
    );
    return { ok: true, plate: vehicle[0].plate };
  }

  async unassignVehicleFromFleet(fleetId: string, vehicleId: string) {
    await this.db.query(`DELETE FROM fleet_vehicles WHERE "fleetId" = $1 AND "vehicleId" = $2`, [fleetId, vehicleId]);
    return { ok: true };
  }

  trips(status?: string) {
    const s = status && TRIP_STATUSES.includes(status) ? status : null;
    return this.db.query(TRIP_SELECT + ` WHERE ($1::text IS NULL OR t.status::text = $1) ORDER BY t."createdAt" DESC LIMIT 200`, [s]);
  }
}












