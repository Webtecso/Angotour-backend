import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trip, TripStatus } from './entities/trip.entity';
import { Driver, DriverStatus } from '../drivers/entities/driver.entity';
import { CATEGORY_PRICING, calculatePriceBreakdown, calculateTripPrice } from '../../common/vehicle-categories';
import { haversineDistanceKm } from '../../common/geo.util';
import { findZone, zoneIncentiveForPoint } from '../../common/zones';
import { EstimateTripDto } from './dto/estimate-trip.dto';
import { CreateTripDto } from './dto/create-trip.dto';
import { VehicleCategoryId } from '../vehicles/entities/vehicle.entity';
import { vehicleApproved } from '../../common/vehicle-approval';
import { getCommissionRate } from '../../common/platform-config';
import { commissionKzFor } from '../../common/commission-plans';
import { TrackingGateway, TripAssignedPayload } from '../tracking/tracking.gateway';
import { DriverTripView } from './driver-trip.view';
import { DriverWalletService } from '../driver-wallet/driver-wallet.service';
import { DriverDocumentsService } from '../driver-documents/driver-documents.service';
import { WalletService } from '../wallet/wallet.service';

export interface CategoryEstimate {
  categoryId: VehicleCategoryId;
  name: string;
  distanceKm: number;
  etaMinutes: number;
  priceKz: number;
}

const MAX_MATCH_RADIUS_KM = 30;
const MAX_BOARDING_ATTEMPTS = 5;
const BOARDING_LOCK_MS = 10 * 60 * 1000;

const DEMO_DRIVERS = [
  { fullName: 'João Manuel', phone: '+244923000111', rating: 4.9, lat: -8.9155, lng: 13.1802 },
  { fullName: 'Carlos Fernandes', phone: '+244923000222', rating: 4.8, lat: -8.928, lng: 13.1955 },
  { fullName: 'Ana Beatriz', phone: '+244923000333', rating: 5.0, lat: -8.919, lng: 13.175, gender: 'female' },
];

@Injectable()
export class TripsService implements OnModuleInit {
  constructor(
    @InjectRepository(Trip)
    private readonly tripsRepository: Repository<Trip>,
    private readonly tracking: TrackingGateway,
    private readonly driverWallet: DriverWalletService,
    private readonly driverDocs: DriverDocumentsService,
    private readonly passengerWallet: WalletService,
  ) {
    this.startReservationSweeper();
  }

  /** Em desenvolvimento garante motoristas demo online logo ao arrancar (para o mapa mostrar carros reais). */
  async onModuleInit(): Promise<void> {
    try {
      await this.ensureDemoDrivers();
      await this.driversRepository.update({ phone: '+244923000333' }, { gender: 'female' });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[Trips] nao foi possivel criar motoristas demo:', (e as Error).message);
    }
  }

  private get driversRepository(): Repository<Driver> {
    return this.tripsRepository.manager.getRepository(Driver);
  }

  estimateAllCategories(dto: EstimateTripDto): CategoryEstimate[] {
    const distanceKm = haversineDistanceKm(dto.origin, dto.destination);

    return Object.values(CATEGORY_PRICING).map((pricing) => ({
      categoryId: pricing.id,
      name: pricing.name,
      distanceKm: Number(distanceKm.toFixed(2)),
      etaMinutes: pricing.etaMinutes,
      priceKz: calculateTripPrice(distanceKm, pricing.id),
      priceBreakdown: calculatePriceBreakdown(distanceKm, pricing.id),
    }));
  }

  async create(passengerId: string, dto: CreateTripDto): Promise<Trip> {
    const distanceKm = haversineDistanceKm(
      { latitude: dto.origin.latitude, longitude: dto.origin.longitude },
      { latitude: dto.destination.latitude, longitude: dto.destination.longitude },
    );
    const pricing = CATEGORY_PRICING[dto.categoryId];
    const boardingCode = Math.floor(1000 + Math.random() * 9000).toString();

    const trip = this.tripsRepository.create({
      passenger: { id: passengerId } as any,
      categoryId: dto.categoryId,
      origin: dto.origin,
      destination: dto.destination,
      distanceKm: Number(distanceKm.toFixed(2)),
      etaMinutes: pricing.etaMinutes,
      priceKz: calculateTripPrice(distanceKm, dto.categoryId),
      priceBreakdown: calculatePriceBreakdown(distanceKm, dto.categoryId) as any,
      status: TripStatus.SEARCHING_DRIVER,
      boardingCode,
      scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
      paymentMethodType: dto.paymentMethodType ?? 'wallet',
      cashNoteKz: dto.paymentMethodType === 'cash' ? dto.cashNoteKz : undefined,
      changeKz:
        dto.paymentMethodType === 'cash' && dto.cashNoteKz
          ? Math.max(0, dto.cashNoteKz - calculateTripPrice(distanceKm, dto.categoryId))
          : undefined,
      comfortPreferences: dto.comfortPreferences,
      splitCount: dto.splitCount && dto.splitCount > 1 ? dto.splitCount : undefined,
      airportPickup: dto.airportPickup,
      womenMode: dto.womenMode ?? false,
      zoneIncentiveKz: zoneIncentiveForPoint(dto.destination.latitude, dto.destination.longitude),
    });

    return this.tripsRepository.save(trip);
  }

  async findByIdOrFail(id: string): Promise<Trip> {
    const trip = await this.tripsRepository.findOne({ where: { id }, relations: ['passenger', 'driver'] });
    if (!trip) throw new NotFoundException('Viagem nao encontrada.');
    return trip;
  }

  async findOwnedOrFail(id: string, userId: string): Promise<Trip> {
    const trip = await this.findByIdOrFail(id);
    if (trip.passenger?.id !== userId) throw new ForbiddenException('Esta viagem nao te pertence.');
    trip.paymentConfirmed = await this.paymentConfirmedFor(trip);
    return trip;
  }

  /**
   * Pagamento por carteira e debitado automaticamente: o saldo (wallet do
   * passageiro) ja desconta viagens concluidas pagas por wallet. Se o saldo
   * ficar negativo, a viagem fica concluida mas NAO fica confirmada como
   * paga por carteira (paymentConfirmed=false).
   */
  private async paymentConfirmedFor(trip: Trip): Promise<boolean> {
    if (trip.status !== TripStatus.COMPLETED) return false;
    if (trip.paymentMethodType !== 'wallet') return true;
    if (!trip.passenger?.id) return true;
    const { balanceKz } = await this.passengerWallet.summary(trip.passenger.id);
    return balanceKz >= 0;
  }

  findAllForPassenger(passengerId: string): Promise<Trip[]> {
    return this.tripsRepository.find({
      where: { passenger: { id: passengerId } },
      order: { createdAt: 'DESC' },
      relations: ['driver'],
    });
  }

  async updateStatus(id: string, status: TripStatus): Promise<Trip> {
    const trip = await this.findByIdOrFail(id);
    trip.status = status;
    return this.tripsRepository.save(trip);
  }

  /** Em desenvolvimento, cria 3 motoristas demo online se nao houver nenhum online. */
  private async ensureDemoDrivers(): Promise<void> {
    if (process.env.NODE_ENV === 'production') return;
    const repo = this.driversRepository;
    const online = await repo.count({ where: { status: DriverStatus.ONLINE } });
    if (online > 0) return;

    for (const d of DEMO_DRIVERS) {
      let driver = await repo.findOne({ where: { phone: d.phone } });
      if (!driver) {
        driver = await repo.save(repo.create({ fullName: d.fullName, phone: d.phone, rating: d.rating, isVerified: true }));
      }
      await repo.update(driver.id, { status: DriverStatus.ONLINE });
      await repo
        .createQueryBuilder()
        .update(Driver)
        .set({ currentLocation: () => `ST_SetSRID(ST_MakePoint(${d.lng}, ${d.lat}), 4326)::geography` } as any)
        .where('id = :id', { id: driver.id })
        .execute();
    }
  }

  async assignDriver(id: string, userId: string, preferDriverId?: string, preferPhones?: string[], preferFemale?: boolean) {
    const trip = await this.findOwnedOrFail(id, userId);
    if (trip.status !== TripStatus.SEARCHING_DRIVER) {
      throw new BadRequestException('Esta viagem ja tem motorista ou ja terminou.');
    }
    // Reserva: so se procura motorista perto da hora marcada (janela de 20 min).
    const SCHEDULE_ASSIGN_WINDOW_MS = 20 * 60 * 1000;
    if (trip.scheduledFor && new Date(trip.scheduledFor).getTime() - Date.now() > SCHEDULE_ASSIGN_WINDOW_MS) {
      throw new BadRequestException('Esta viagem esta agendada. O motorista e atribuido perto da hora marcada.');
    }

    await this.ensureDemoDrivers();

    const { latitude, longitude } = trip.origin;
    const rows = await this.driversRepository
      .createQueryBuilder('driver')
      .addSelect(
        `ST_Distance(driver.currentLocation, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)`,
        'dist',
      )
      .where('driver.status = :status', { status: DriverStatus.ONLINE })
      .andWhere('driver.currentLocation IS NOT NULL')
      .setParameters({ lat: latitude, lng: longitude, status: DriverStatus.ONLINE })
      .getRawAndEntities();

    const penalized = await this.penalizedDriverIds();
    const allCandidates = rows.entities
      .map((driver, i) => ({ driver, distanceKm: Number(rows.raw[i].dist) / 1000 }))
      .filter((c) => c.distanceKm <= MAX_MATCH_RADIUS_KM && !this.declinedDrivers.get(trip.id)?.has(c.driver.id))
      .sort((a, b) => {
        const score = (c: { driver: Driver }) =>
          (penalized.has(c.driver.id) ? -3 : 0) + (c.driver.id === preferDriverId ? 2 : 0) + (preferPhones?.includes(c.driver.phone) ? 1 : 0) + ((preferFemale ?? trip.womenMode) && c.driver.gender === 'female' ? 4 : 0);
        return score(b) - score(a) || a.distanceKm - b.distanceKm;
      });

    const candidates = await this.filterOperational(allCandidates, this.driverCommissionKz(trip.priceKz));

    if (candidates.length === 0) throw new NotFoundException('Sem motoristas disponiveis por perto.');

    const chosen = candidates[0].driver;
    trip.driver = chosen;
    trip.status = TripStatus.DRIVER_ASSIGNED;
    await this.tripsRepository.save(trip);
    await this.driversRepository.update(chosen.id, { status: DriverStatus.ON_TRIP });

    const loc = await this.tripsRepository.manager.query(
      `SELECT ST_Y("currentLocation"::geometry) AS lat, ST_X("currentLocation"::geometry) AS lng FROM drivers WHERE id = $1`,
      [chosen.id],
    );
    const driverLocation = loc[0] ? { latitude: Number(loc[0].lat), longitude: Number(loc[0].lng) } : null;

    this.tracking.broadcastTripStatus({ tripId: trip.id, status: trip.status });
    this.tracking.notifyDriverAssigned(chosen.id, this.buildAssignedPayload(trip, candidates[0].distanceKm));
    // Veiculo aprovado do motorista escolhido (null para motoristas demo, que nao tem veiculo).
    const vehicleRows = await this.tripsRepository.manager.query(
      `SELECT model, plate, color, "categoryId"::text AS "categoryId" FROM vehicles WHERE "driverId" = $1 AND status = 'approved' LIMIT 1`,
      [chosen.id],
    );
    const vehicle = vehicleRows[0] ?? null;
    return { ...trip, driverLocation, vehicle };
  }

  // Sem saldo para a comissao (ou abaixo do minimo) nao recebe corridas.
  // Motoristas demo (so em desenvolvimento) ficam isentos: nao tem carteira.
  private async filterOperational<T extends { driver: Driver }>(list: T[], commissionKz: number): Promise<T[]> {
    const demoPhones = DEMO_DRIVERS.map((d) => d.phone);
    const result: T[] = [];
    for (const item of list) {
      const isDemoDriver = demoPhones.includes(item.driver.phone);
      // Motoristas demo so entram se forem pedidos de forma explicita (ALLOW_DEMO_DRIVERS=true), nunca por omissao.
      const isDemo = isDemoDriver && process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_DRIVERS === 'true';
      if (isDemoDriver && !isDemo) continue;
      if (isDemo) { result.push(item); continue; }
      if (!(await this.driverDocs.areAllApproved(item.driver.id))) continue;
      if (!(await vehicleApproved(this.tripsRepository.manager, item.driver.id))) continue;
      if (await this.driverWallet.canOperate(item.driver.id, commissionKz)) result.push(item);
    }
    return result;
  }

  /** Payload enviado ao motorista via socket - nunca inclui o boardingCode. */
  private buildAssignedPayload(trip: Trip, distanceToPassengerKm: number): TripAssignedPayload {
    return {
      tripId: trip.id,
      originLabel: trip.origin.label || trip.origin.address,
      destinationLabel: findZone(trip.destination.latitude, trip.destination.longitude).name,
      distanceToPassengerKm,
      tripDistanceKm: trip.distanceKm,
      tripDurationMinutes: Math.max(1, Math.round((trip.distanceKm / 25) * 60)),
      estimatedEarningsKz: trip.priceKz,
      estimatedCommissionKz: this.driverCommissionKz(trip.priceKz),
      zoneIncentiveKz: trip.zoneIncentiveKz ?? 0,
      paymentMethod: trip.paymentMethodType,
      passengerCoordinates: { latitude: trip.origin.latitude, longitude: trip.origin.longitude },
      destinationCoordinates: (() => { const z = findZone(trip.destination.latitude, trip.destination.longitude); return { latitude: z.centerLat, longitude: z.centerLng }; })(),
    };
  }

  /** AngoPoints: 1 ponto por cada 100 Kz de viagem concluida (nao bloqueia a viagem se falhar). */
  private async awardPoints(userId: string, priceKz: number): Promise<void> {
    try {
      const points = Math.max(1, Math.floor(priceKz / 100));
      await this.tripsRepository.manager.query(
        `INSERT INTO user_profiles ("userId","isVerified","angoPoints") VALUES ($1,false,$2)
         ON CONFLICT ("userId") DO UPDATE SET "angoPoints" = user_profiles."angoPoints" + $2`,
        [userId, points],
      );
    } catch {
      // ignorar: pontos nunca podem impedir a conclusao da viagem
    }
  }

  // ---------- Reservas: activacao a hora, falta do motorista e penalizacao ----------
  // Desligado por defeito: so corre com RESERVATIONS_AUTO=true no .env, depois de a app do passageiro
  // conseguir abrir a viagem quando a reserva ganha motorista.
  private reservationTimer: ReturnType<typeof setInterval> | null = null;
  private sweeping = false;

  private startReservationSweeper(): void {
    if (this.reservationTimer) return;
    const m = this.tripsRepository.manager;
    m.query(
      `CREATE TABLE IF NOT EXISTS driver_penalties (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         "driverId" uuid NOT NULL,
         "tripId" uuid,
         reason varchar(40) NOT NULL,
         "createdAt" timestamptz NOT NULL DEFAULT now(),
         "expiresAt" timestamptz NOT NULL
       )`,
    )
      .then(() => m.query(`CREATE INDEX IF NOT EXISTS driver_penalties_active_idx ON driver_penalties ("driverId", "expiresAt")`))
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[Reservas] tabela de penalizacoes:', (e as Error).message);
      });
    if (process.env.RESERVATIONS_AUTO !== 'true') return;
    const timer: any = setInterval(() => { void this.sweepReservations(); }, 60000);
    timer.unref?.();
    this.reservationTimer = timer;
    // eslint-disable-next-line no-console
    console.log('[Reservas] activacao automatica ligada (verifica a cada 60 s).');
  }

  /** Motoristas com penalizacao activa: descem na ordenacao, mas nao sao bloqueados. */
  private async penalizedDriverIds(): Promise<Set<string>> {
    try {
      const rows: Array<{ driverId: string }> = await this.tripsRepository.manager.query(
        `SELECT DISTINCT "driverId" FROM driver_penalties WHERE "expiresAt" > now()`,
      );
      return new Set(rows.map((r) => r.driverId));
    } catch {
      return new Set<string>();
    }
  }

  private async sweepReservations(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    const ACTIVATE_MIN = 15; // procura motorista a partir de 15 min antes da hora
    const GRACE_MIN = 10; // tolerancia depois da hora marcada
    const PENALTY_DAYS = 7; // duracao da penalizacao
    try {
      const m = this.tripsRepository.manager;

      // 1) Faltas: motorista atribuido que nao confirmou o embarque ate GRACE_MIN depois da hora.
      const late: Array<{ id: string; driverId: string }> = await m.query(
        `SELECT id, "driverId" FROM trips
         WHERE "scheduledFor" IS NOT NULL
           AND "driverId" IS NOT NULL
           AND status::text IN ('driver_assigned','driver_arriving')
           AND "boardingConfirmedAt" IS NULL
           AND "scheduledFor" + make_interval(mins => $1::int) < now()
           AND "scheduledFor" > now() - interval '12 hours'`,
        [GRACE_MIN],
      );
      for (const t of late) {
        await m.query(
          `INSERT INTO driver_penalties ("driverId", "tripId", reason, "expiresAt")
           VALUES ($1, $2, 'reservation_no_show', now() + make_interval(days => $3::int))`,
          [t.driverId, t.id, PENALTY_DAYS],
        );
        try { await this.driverWallet.releaseCommission(t.driverId, t.id); } catch { /* sem reserva de comissao */ }
        const declined = this.declinedDrivers.get(t.id) ?? new Set<string>();
        declined.add(t.driverId);
        this.declinedDrivers.set(t.id, declined);
        this.boardingAttempts.delete(t.id);
        await m.query(
          `UPDATE trips SET "driverId" = NULL, status = 'searching_driver', "boardingConfirmedAt" = NULL WHERE id = $1`,
          [t.id],
        );
        await m.query(`UPDATE drivers SET status = 'online' WHERE id = $1 AND status::text = 'on_trip'`, [t.driverId]);
        this.tracking.broadcastTripStatus({ tripId: t.id, status: 'searching_driver' });
      }

      // 2) Activacao: reservas a ACTIVATE_MIN da hora (inclui as que acabaram de ficar sem motorista).
      const due: Array<{ id: string; passengerId: string }> = await m.query(
        `SELECT id, "passengerId" FROM trips
         WHERE "scheduledFor" IS NOT NULL
           AND status::text = 'searching_driver'
           AND "scheduledFor" <= now() + make_interval(mins => $1::int)
           AND "scheduledFor" > now() - interval '2 hours'`,
        [ACTIVATE_MIN],
      );
      for (const t of due) {
        try {
          const claim: Array<{ driverId: string }> = await m.query(`SELECT "driverId" FROM trip_reservation_claims WHERE "tripId" = $1`, [t.id]).catch(() => []);
          const claimed = claim[0]?.driverId;
          const assigned: any = claimed
            ? await this.assignDriver(t.id, t.passengerId, claimed)
            : await this.assignDriver(t.id, t.passengerId);
          if (claimed) {
            await m.query(`DELETE FROM trip_reservation_claims WHERE "tripId" = $1`, [t.id]);
            if (assigned?.driver?.id !== claimed) {
              // regra B: quem reservou e nao estava disponivel a hora perde prioridade
              await m.query(
                `INSERT INTO driver_penalties ("driverId", "tripId", reason, "expiresAt")
                 VALUES ($1, $2, 'reservation_unavailable', now() + make_interval(days => $3::int))`,
                [claimed, t.id, PENALTY_DAYS],
              );
            }
          }
        } catch {
          // sem motorista disponivel por agora: tenta no ciclo seguinte
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[Reservas] erro no ciclo:', (e as Error).message);
    } finally {
      this.sweeping = false;
    }
  }

  // ---------- Reservas: o motorista reserva com antecedencia ----------
  // Reservar NAO atribui nem poe o motorista on_trip. A atribuicao real faz-se perto da hora,
  // no sweepReservations, com preferencia para quem reservou.
  private claimsReady?: Promise<unknown>;

  private ensureClaims(): Promise<unknown> {
    if (!this.claimsReady) {
      this.claimsReady = this.tripsRepository.manager
        .query(`CREATE TABLE IF NOT EXISTS trip_reservation_claims (
           "tripId" uuid PRIMARY KEY,
           "driverId" uuid NOT NULL,
           "createdAt" timestamptz NOT NULL DEFAULT now()
         )`)
        .catch((e) => { this.claimsReady = undefined; throw e; });
    }
    return this.claimsReady;
  }

  /** Reservas abertas (sem motorista) e as que este motorista ja reservou. Destino so como zona. */
  async driverScheduled(driverId: string) {
    await this.ensureClaims();
    const rows: any[] = await this.tripsRepository.manager.query(
      `SELECT t.id, t."scheduledFor", t.origin, t.destination, t."priceKz", t."distanceKm", t."zoneIncentiveKz",
              (c."driverId" IS NOT NULL) AS mine
         FROM trips t
         LEFT JOIN trip_reservation_claims c ON c."tripId" = t.id
        WHERE t."scheduledFor" IS NOT NULL
          AND t."scheduledFor" > now()
          AND t.status::text = 'searching_driver'
          AND (c."driverId" IS NULL OR c."driverId" = $1)
        ORDER BY t."scheduledFor" ASC
        LIMIT 50`,
      [driverId],
    );
    return rows.map((r) => ({
      id: r.id,
      dateIso: new Date(r.scheduledFor).toISOString(),
      originLabel: r.origin?.label || r.origin?.address || '-',
      destinationLabel: findZone(r.destination.latitude, r.destination.longitude).name,
      estimatedEarningsKz: r.priceKz,
      zoneIncentiveKz: r.zoneIncentiveKz ?? 0,
      distanceKm: Number(r.distanceKm),
      isAccepted: r.mine === true,
    }));
  }

  async driverReserve(tripId: string, driverId: string): Promise<{ ok: boolean }> {
    await this.ensureClaims();
    const m = this.tripsRepository.manager;
    const trip = await this.findByIdOrFail(tripId);
    if (!trip.scheduledFor || trip.status !== TripStatus.SEARCHING_DRIVER || trip.driver) {
      throw new BadRequestException('Esta reserva ja nao esta disponivel.');
    }
    const when = new Date(trip.scheduledFor).getTime();
    if (when <= Date.now()) throw new BadRequestException('Esta reserva ja passou da hora marcada.');
    if (!(await this.driverDocs.areAllApproved(driverId))) throw new BadRequestException('Precisas dos documentos aprovados para reservar.');
    if (!(await vehicleApproved(m, driverId))) throw new BadRequestException('Precisas de um veiculo aprovado para reservar.');
    if (!(await this.driverWallet.canOperate(driverId, this.driverCommissionKz(trip.priceKz)))) {
      throw new BadRequestException('Saldo insuficiente para a comissao desta reserva.');
    }
    const clash = await m.query(
      `SELECT 1 FROM trip_reservation_claims c JOIN trips t ON t.id = c."tripId"
        WHERE c."driverId" = $1
          AND t."scheduledFor" BETWEEN $2::timestamptz - interval '60 minutes' AND $2::timestamptz + interval '60 minutes'
        LIMIT 1`,
      [driverId, new Date(when).toISOString()],
    );
    if (clash.length) throw new BadRequestException('Ja tens uma reserva a menos de 1 hora desta.');
    const res = await m.query(
      `INSERT INTO trip_reservation_claims ("tripId", "driverId") VALUES ($1, $2)
       ON CONFLICT ("tripId") DO NOTHING RETURNING "tripId"`,
      [tripId, driverId],
    );
    if (!res.length) throw new BadRequestException('Outro motorista reservou primeiro.');
    return { ok: true };
  }

  async driverUnreserve(tripId: string, driverId: string): Promise<{ ok: boolean }> {
    await this.ensureClaims();
    const m = this.tripsRepository.manager;
    const rows: any[] = await m.query(
      `SELECT t."scheduledFor" FROM trip_reservation_claims c JOIN trips t ON t.id = c."tripId"
        WHERE c."tripId" = $1 AND c."driverId" = $2`,
      [tripId, driverId],
    );
    if (!rows.length) throw new BadRequestException('Nao tens esta reserva.');
    if (new Date(rows[0].scheduledFor).getTime() - Date.now() < 60 * 60 * 1000) {
      throw new BadRequestException('So podes desistir ate 1 hora antes da hora marcada.');
    }
    await m.query(`DELETE FROM trip_reservation_claims WHERE "tripId" = $1 AND "driverId" = $2`, [tripId, driverId]);
    return { ok: true };
  }

  private async releaseDriver(trip: Trip): Promise<void> {
    if (trip.driver) await this.driversRepository.update(trip.driver.id, { status: DriverStatus.ONLINE });
  }

  async start(id: string, userId: string): Promise<Trip> {
    const trip = await this.findOwnedOrFail(id, userId);
    if (![TripStatus.DRIVER_ASSIGNED, TripStatus.DRIVER_ARRIVING].includes(trip.status)) {
      throw new BadRequestException('A viagem ainda nao tem motorista atribuido.');
    }
    trip.status = TripStatus.IN_PROGRESS;
    trip.startedAt = new Date();
    const started = await this.tripsRepository.save(trip);
    this.tracking.broadcastTripStatus({ tripId: started.id, status: started.status });
    return started;
  }

  async complete(id: string, userId: string, actualDistanceKm?: number): Promise<Trip> {
    const trip = await this.findOwnedOrFail(id, userId);
    if (trip.status !== TripStatus.IN_PROGRESS) {
      throw new BadRequestException('So podes concluir uma viagem em curso.');
    }
    trip.status = TripStatus.COMPLETED;
    trip.completedAt = new Date();
    await this.awardPoints(userId, trip.priceKz);
    if (trip.driver) {
      await this.driverWallet.settleCommission(trip.driver.id, trip.id, await this.commissionFor(trip.driver.id, trip.priceKz));
      await this.driverWallet.payZoneIncentive(trip.driver.id, trip.id, trip.zoneIncentiveKz ?? 0);
    }
    if (typeof actualDistanceKm === 'number') trip.actualDistanceKm = Number(actualDistanceKm.toFixed(2));
    const saved = await this.tripsRepository.save(trip);
    await this.releaseDriver(trip);
    this.tracking.broadcastTripStatus({ tripId: saved.id, status: saved.status });
    return saved;
  }

  // ---------- Lado do motorista ----------

  // Quem recusou cada viagem. Em memoria: chega para desenvolvimento; em producao
  // deve ir para a base de dados ou Redis.
  private readonly declinedDrivers = new Map<string, Set<string>>();

  // Tentativas falhadas do codigo de embarque, por viagem (em memoria).
  private readonly boardingAttempts = new Map<string, { failures: number; lockedUntil: number }>();

  // Comissao da plataforma: 12% do valor da corrida (documento de produto).
  private driverCommissionKz(priceKz: number): number {
    return Math.round((priceKz * getCommissionRate()) / 50) * 50;
  }

﻿  /** Comissao desta corrida segundo o plano do motorista (economy | pro | subscription). */
  private async commissionFor(driverId: string, priceKz: number): Promise<number> {
    const rows = await this.tripsRepository.query(`SELECT "commissionPlan" FROM drivers WHERE id = $1`, [driverId]);
    return commissionKzFor(priceKz, rows[0]?.commissionPlan);
  }

  private toDriverView(trip: Trip, distanceToPassengerKm: number | null): DriverTripView {
    const commissionKz = this.driverCommissionKz(trip.priceKz);
    return {
      id: trip.id,
      status: trip.status,
      passengerName: trip.passenger?.fullName ?? 'Passageiro',
      origin: trip.origin,
      destination: trip.status === TripStatus.DRIVER_ASSIGNED
        ? (() => { const z = findZone(trip.destination.latitude, trip.destination.longitude); return { label: z.name, address: z.name, latitude: z.centerLat, longitude: z.centerLng }; })()
        : trip.destination,
      distanceKm: trip.distanceKm,
      durationMinutes: Math.max(1, Math.round((trip.distanceKm / 25) * 60)),
      distanceToPassengerKm,
      priceKz: trip.priceKz,
      commissionKz,
      zoneIncentiveKz: trip.zoneIncentiveKz ?? 0,
      netEarningsKz: trip.priceKz - commissionKz + (trip.zoneIncentiveKz ?? 0),
      paymentMethodType: trip.paymentMethodType,
      boardingConfirmed: !!trip.boardingConfirmedAt,
    };
  }

  private async driverOwnedTripOrFail(tripId: string, driverId: string): Promise<Trip> {
    const trip = await this.findByIdOrFail(tripId);
    if (trip.driver?.id !== driverId) throw new ForbiddenException('Esta viagem nao esta atribuida a ti.');
    return trip;
  }

  /** Viagem atribuida a este motorista que ainda nao terminou (ou { trip: null }). */
  async driverActiveTrip(driverId: string): Promise<{ trip: DriverTripView | null }> {
    const trip = await this.tripsRepository.findOne({
      where: [
        { driver: { id: driverId }, status: TripStatus.DRIVER_ASSIGNED },
        { driver: { id: driverId }, status: TripStatus.DRIVER_ARRIVING },
        { driver: { id: driverId }, status: TripStatus.IN_PROGRESS },
      ],
      relations: ['passenger', 'driver'],
      order: { createdAt: 'DESC' },
    });
    if (!trip) return { trip: null };

    const rows = await this.tripsRepository.manager.query(
      `SELECT ST_Distance("currentLocation", ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 AS km
       FROM drivers WHERE id = $3 AND "currentLocation" IS NOT NULL`,
      [trip.origin.longitude, trip.origin.latitude, driverId],
    );
    const km = rows[0] ? Number(rows[0].km) : null;
    return { trip: this.toDriverView(trip, km) };
  }

  async driverAccept(tripId: string, driverId: string): Promise<{ ok: boolean; status: TripStatus }> {
    const trip = await this.driverOwnedTripOrFail(tripId, driverId);
    if (trip.status === TripStatus.DRIVER_ARRIVING) return { ok: true, status: trip.status };
    if (trip.status !== TripStatus.DRIVER_ASSIGNED) {
      throw new BadRequestException('Esta viagem ja nao esta disponivel para aceitar.');
    }
    await this.driverWallet.reserveCommission(driverId, trip.id, await this.commissionFor(driverId, trip.priceKz));
    trip.status = TripStatus.DRIVER_ARRIVING;
    const saved = await this.tripsRepository.save(trip);
    this.tracking.broadcastTripStatus({ tripId: saved.id, status: saved.status });
    return { ok: true, status: saved.status };
  }

  /** Recusa: liberta o motorista e passa a viagem ao proximo elegivel (sem repetir quem recusou). */
  async driverDecline(tripId: string, driverId: string): Promise<{ reassigned: boolean }> {
    const trip = await this.driverOwnedTripOrFail(tripId, driverId);
    if (trip.status !== TripStatus.DRIVER_ASSIGNED) {
      throw new BadRequestException('So podes recusar antes de aceitar.');
    }

    const declined = this.declinedDrivers.get(trip.id) ?? new Set<string>();
    declined.add(driverId);
    this.declinedDrivers.set(trip.id, declined);
    this.boardingAttempts.delete(trip.id);
    // O proximo motorista tem de confirmar o codigo por si.
    (trip as any).boardingConfirmedAt = null;
    await this.driversRepository.update(driverId, { status: DriverStatus.ONLINE });

    const { latitude, longitude } = trip.origin;
    const rows = await this.driversRepository
      .createQueryBuilder('driver')
      .addSelect(`ST_Distance(driver.currentLocation, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)`, 'dist')
      .where('driver.status = :status', { status: DriverStatus.ONLINE })
      .andWhere('driver.currentLocation IS NOT NULL')
      .setParameters({ lat: latitude, lng: longitude, status: DriverStatus.ONLINE })
      .getRawAndEntities();

    const penalized = await this.penalizedDriverIds();
    const nextPool = rows.entities
      .map((driver, i) => ({ driver, distanceKm: Number(rows.raw[i].dist) / 1000 }))
      .filter((c) => c.distanceKm <= MAX_MATCH_RADIUS_KM && !declined.has(c.driver.id))
      .sort((a, b) => {
        const score = (c: { driver: Driver }) => (penalized.has(c.driver.id) ? -3 : 0) + (trip.womenMode && c.driver.gender === 'female' ? 4 : 0);
        return score(b) - score(a) || a.distanceKm - b.distanceKm;
      });

    const next = (await this.filterOperational(nextPool, this.driverCommissionKz(trip.priceKz)))[0];

    if (!next) {
      (trip as any).driver = null;
      trip.status = TripStatus.SEARCHING_DRIVER;
      await this.tripsRepository.save(trip);
      this.tracking.broadcastTripStatus({ tripId: trip.id, status: trip.status });
      return { reassigned: false };
    }

    trip.driver = next.driver;
    trip.status = TripStatus.DRIVER_ASSIGNED;
    await this.tripsRepository.save(trip);
    await this.driversRepository.update(next.driver.id, { status: DriverStatus.ON_TRIP });
    this.tracking.notifyDriverAssigned(next.driver.id, this.buildAssignedPayload(trip, next.distanceKm));
    this.tracking.broadcastTripStatus({ tripId: trip.id, status: trip.status });
    return { reassigned: true };
  }

  /** O servidor compara o codigo: o motorista nunca o recebe. */
  async driverConfirmBoarding(tripId: string, driverId: string, code: string): Promise<{ ok: boolean }> {
    const trip = await this.driverOwnedTripOrFail(tripId, driverId);
    if (![TripStatus.DRIVER_ASSIGNED, TripStatus.DRIVER_ARRIVING, TripStatus.IN_PROGRESS].includes(trip.status)) {
      throw new BadRequestException('A viagem nao esta a aguardar embarque.');
    }
    const now = Date.now();
    const state = this.boardingAttempts.get(trip.id) ?? { failures: 0, lockedUntil: 0 };
    if (state.lockedUntil > now) {
      const minutes = Math.ceil((state.lockedUntil - now) / 60000);
      throw new HttpException('Demasiadas tentativas. Tenta novamente dentro de ' + minutes + ' min.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (typeof code !== 'string' || !trip.boardingCode || trip.boardingCode !== code) {
      state.failures += 1;
      if (state.failures >= MAX_BOARDING_ATTEMPTS) {
        state.failures = 0;
        state.lockedUntil = now + BOARDING_LOCK_MS;
      }
      this.boardingAttempts.set(trip.id, state);
      throw new BadRequestException('Codigo de embarque incorreto.');
    }
    this.boardingAttempts.delete(trip.id);
    await this.assertDriverNearPickup(trip, driverId);
    trip.boardingConfirmedAt = new Date();
    await this.tripsRepository.save(trip);
    return { ok: true };
  }

  // Trava de proximidade: o motorista tem de estar perto do ponto de recolha para confirmar o embarque.
  // O GPS em Luanda tem desvios grandes, por isso o raio e generoso (BOARDING_MAX_DISTANCE_M, 300 m por omissao).
  // So bloqueia com ENFORCE_BOARDING_PROXIMITY=true; sem isso apenas regista o aviso na consola.
  private async assertDriverNearPickup(trip: Trip, driverId: string): Promise<void> {
    const rows = await this.tripsRepository.manager.query(
      `SELECT ST_Distance("currentLocation", ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS m FROM drivers WHERE id = $3 AND "currentLocation" IS NOT NULL`,
      [trip.origin.longitude, trip.origin.latitude, driverId],
    );
    if (!rows[0]) return; // sem posicao conhecida: nao bloqueia (o GPS pode falhar)
    const meters = Number(rows[0].m);
    const maxMeters = Number(process.env.BOARDING_MAX_DISTANCE_M ?? 300);
    if (!Number.isFinite(meters) || meters <= maxMeters) return;
    if (process.env.ENFORCE_BOARDING_PROXIMITY === 'true') {
      throw new BadRequestException('Ainda estas longe do ponto de recolha. Aproxima-te do passageiro para confirmar o embarque.');
    }
    // eslint-disable-next-line no-console
    console.warn('[Boarding] motorista a ' + Math.round(meters) + ' m do ponto de recolha (maximo ' + maxMeters + ' m).');
  }
  async driverStart(tripId: string, driverId: string): Promise<{ ok: boolean; status: TripStatus }> {
    const trip = await this.driverOwnedTripOrFail(tripId, driverId);
    if (trip.status === TripStatus.IN_PROGRESS) return { ok: true, status: trip.status };
    if (![TripStatus.DRIVER_ASSIGNED, TripStatus.DRIVER_ARRIVING].includes(trip.status)) {
      throw new BadRequestException('A viagem nao pode ser iniciada neste estado.');
    }
    if (!trip.boardingConfirmedAt) {
      throw new BadRequestException('Confirma o codigo de embarque antes de iniciar.');
    }
    trip.status = TripStatus.IN_PROGRESS;
    trip.startedAt = new Date();
    const saved = await this.tripsRepository.save(trip);
    this.tracking.broadcastTripStatus({ tripId: saved.id, status: saved.status });
    return { ok: true, status: saved.status };
  }

  async driverComplete(tripId: string, driverId: string): Promise<{ ok: boolean; netEarningsKz: number }> {
    const trip = await this.driverOwnedTripOrFail(tripId, driverId);
    const netEarningsKz = trip.priceKz - (await this.commissionFor(driverId, trip.priceKz)) + (trip.zoneIncentiveKz ?? 0);
    if (trip.status === TripStatus.COMPLETED) return { ok: true, netEarningsKz };
    if (trip.status !== TripStatus.IN_PROGRESS) {
      throw new BadRequestException('So podes concluir uma viagem em curso.');
    }
    trip.status = TripStatus.COMPLETED;
    trip.completedAt = new Date();
    const saved = await this.tripsRepository.save(trip);
    if (trip.passenger?.id) await this.awardPoints(trip.passenger.id, trip.priceKz);
    await this.releaseDriver(trip);
    await this.driverWallet.settleCommission(driverId, trip.id, await this.commissionFor(driverId, trip.priceKz));
    await this.driverWallet.payZoneIncentive(driverId, trip.id, trip.zoneIncentiveKz ?? 0);
    this.declinedDrivers.delete(trip.id);
    this.boardingAttempts.delete(trip.id);
    this.tracking.broadcastTripStatus({ tripId: saved.id, status: saved.status });
    return { ok: true, netEarningsKz };
  }

  async cancel(id: string, userId: string, reason?: string): Promise<Trip> {
    const trip = await this.findOwnedOrFail(id, userId);
    if ([TripStatus.IN_PROGRESS, TripStatus.COMPLETED, TripStatus.CANCELLED].includes(trip.status)) {
      throw new BadRequestException('Esta viagem ja nao pode ser cancelada.');
    }
    trip.status = TripStatus.CANCELLED;
    trip.cancelReason = reason?.slice(0, 200);
    if (trip.driver) await this.driverWallet.releaseCommission(trip.driver.id, trip.id);
    const saved = await this.tripsRepository.save(trip);
    await this.releaseDriver(trip);
    this.tracking.broadcastTripStatus({ tripId: saved.id, status: saved.status });
    return saved;
  }
}














