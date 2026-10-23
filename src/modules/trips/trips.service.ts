import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trip, TripStatus } from './entities/trip.entity';
import { Driver, DriverStatus } from '../drivers/entities/driver.entity';
import { CATEGORY_PRICING, calculatePriceBreakdown, calculateTripPrice } from '../../common/vehicle-categories';
import { haversineDistanceKm } from '../../common/geo.util';
import { EstimateTripDto } from './dto/estimate-trip.dto';
import { CreateTripDto } from './dto/create-trip.dto';
import { VehicleCategoryId } from '../vehicles/entities/vehicle.entity';
import { vehicleApproved } from '../../common/vehicle-approval';
import { getCommissionRate } from '../../common/platform-config';
import { TrackingGateway, TripAssignedPayload } from '../tracking/tracking.gateway';
import { DriverTripView } from './driver-trip.view';
import { DriverWalletService } from '../driver-wallet/driver-wallet.service';
import { DriverDocumentsService } from '../driver-documents/driver-documents.service';

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
  ) {}

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
    return trip;
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

    const allCandidates = rows.entities
      .map((driver, i) => ({ driver, distanceKm: Number(rows.raw[i].dist) / 1000 }))
      .filter((c) => c.distanceKm <= MAX_MATCH_RADIUS_KM)
      .sort((a, b) => {
        const score = (c: { driver: Driver }) =>
          (c.driver.id === preferDriverId ? 2 : 0) + (preferPhones?.includes(c.driver.phone) ? 1 : 0) + ((preferFemale ?? trip.womenMode) && c.driver.gender === 'female' ? 4 : 0);
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
      const isDemo = process.env.NODE_ENV !== 'production' && demoPhones.includes(item.driver.phone);
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
      destinationLabel: trip.destination.label || trip.destination.address,
      distanceToPassengerKm,
      tripDistanceKm: trip.distanceKm,
      tripDurationMinutes: Math.max(1, Math.round((trip.distanceKm / 25) * 60)),
      estimatedEarningsKz: trip.priceKz,
      estimatedCommissionKz: this.driverCommissionKz(trip.priceKz),
      paymentMethod: trip.paymentMethodType,
      passengerCoordinates: { latitude: trip.origin.latitude, longitude: trip.origin.longitude },
      destinationCoordinates: { latitude: trip.destination.latitude, longitude: trip.destination.longitude },
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
    if (trip.driver) await this.driverWallet.settleCommission(trip.driver.id, trip.id, this.driverCommissionKz(trip.priceKz));
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

  private toDriverView(trip: Trip, distanceToPassengerKm: number | null): DriverTripView {
    const commissionKz = this.driverCommissionKz(trip.priceKz);
    return {
      id: trip.id,
      status: trip.status,
      passengerName: trip.passenger?.fullName ?? 'Passageiro',
      origin: trip.origin,
      destination: trip.destination,
      distanceKm: trip.distanceKm,
      durationMinutes: Math.max(1, Math.round((trip.distanceKm / 25) * 60)),
      distanceToPassengerKm,
      priceKz: trip.priceKz,
      commissionKz,
      netEarningsKz: trip.priceKz - commissionKz,
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
    await this.driverWallet.reserveCommission(driverId, trip.id, this.driverCommissionKz(trip.priceKz));
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

    const nextPool = rows.entities
      .map((driver, i) => ({ driver, distanceKm: Number(rows.raw[i].dist) / 1000 }))
      .filter((c) => c.distanceKm <= MAX_MATCH_RADIUS_KM && !declined.has(c.driver.id))
      .sort((a, b) => {
        const score = (c: { driver: Driver }) => (trip.womenMode && c.driver.gender === 'female' ? 4 : 0);
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
    this.tracking.notifyDriverAssigned(next.driver.id, this.buildAssignedPayload(trip, next.distanceKm));
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
    trip.boardingConfirmedAt = new Date();
    await this.tripsRepository.save(trip);
    return { ok: true };
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
    const netEarningsKz = trip.priceKz - this.driverCommissionKz(trip.priceKz);
    if (trip.status === TripStatus.COMPLETED) return { ok: true, netEarningsKz };
    if (trip.status !== TripStatus.IN_PROGRESS) {
      throw new BadRequestException('So podes concluir uma viagem em curso.');
    }
    trip.status = TripStatus.COMPLETED;
    trip.completedAt = new Date();
    const saved = await this.tripsRepository.save(trip);
    if (trip.passenger?.id) await this.awardPoints(trip.passenger.id, trip.priceKz);
    await this.releaseDriver(trip);
    await this.driverWallet.settleCommission(driverId, trip.id, this.driverCommissionKz(trip.priceKz));
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














