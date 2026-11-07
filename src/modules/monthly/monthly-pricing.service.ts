import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MonthlyPlan } from './entities/monthly-plan.entity';
import { MonthlyPricingSettings } from './entities/monthly-pricing-settings.entity';
import { UpdateMonthlyPricingDto } from './dto/update-pricing-settings.dto';

const DAY_IDS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const ceil100 = (v: number) => Math.ceil(v / 100) * 100;

export interface MonthlyQuote {
  requestId: string;
  modality: string;
  planId: string | null;
  planName: string | null;
  serviceDays: number;
  trips: number;
  kmPerTrip: number;
  totalKm: number;
  costs: { fuelKz: number; driverKz: number; maintenanceKz: number; insuranceDocsKz: number; otherKz: number; availabilityKz: number };
  routeCostKz: number;
  marginPercent: number;
  riskReservePercent: number;
  targetOccupancy: number;
  currentOccupancy: number;
  minCapacity: number | null;
  belowMinimum: boolean;
  suggestedPriceKz: number;
  minViablePriceKz: number;
  enforceViability: boolean;
}

@Injectable()
export class MonthlyPricingService {
  constructor(
    @InjectRepository(MonthlyPricingSettings) private readonly settings: Repository<MonthlyPricingSettings>,
    @InjectRepository(MonthlyPlan) private readonly plans: Repository<MonthlyPlan>,
  ) {}

  async getSettings(): Promise<MonthlyPricingSettings> {
    await this.settings.createQueryBuilder().insert().into(MonthlyPricingSettings).values({ id: 'default' }).orIgnore().execute();
    return this.settings.findOneByOrFail({ id: 'default' });
  }

  async updateSettings(dto: UpdateMonthlyPricingDto): Promise<MonthlyPricingSettings> {
    const s = await this.getSettings();
    Object.assign(s, dto);
    return this.settings.save(s);
  }

  /**
   * Preco sugerido para um pedido.
   * Custo da rota = combustivel + motorista + manutencao + seguro/documentacao + outros (+ disponibilidade, no individual).
   * Partilhado: preco por lugar = custo com margem e reserva / ocupacao. Individual: custo com margem e reserva.
   */
  async quote(requestId: string, opts: { planId?: string; payingPassengers?: number } = {}): Promise<MonthlyQuote> {
    const rows = await this.settings.query(
      `SELECT r.id, r.modality, r."passengerCount", r."preferredDays", r."returnTime"::text AS "returnTime",
              r."startDate"::text AS "startDate",
              ST_Distance(r."originLocation", r."destinationLocation") / 1000.0 AS "straightKm"
       FROM monthly_service_requests r WHERE r.id = $1`,
      [requestId],
    );
    const r = rows[0];
    if (!r) throw new NotFoundException('Pedido nao encontrado.');

    let plan: MonthlyPlan | null = null;
    if (opts.planId) {
      plan = await this.plans.findOne({ where: { id: opts.planId } });
      if (!plan) throw new NotFoundException('Plano nao encontrado.');
    }
    const s = await this.getSettings();

    // dias de servico no periodo (inicio ate um mes depois, menos um dia)
    const days: string[] = typeof r.preferredDays === 'string' && r.preferredDays ? r.preferredDays.split(',') : [];
    const start = new Date(String(r.startDate).slice(0, 10) + 'T00:00:00Z');
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(end.getUTCDate() - 1);
    let serviceDays = 0;
    for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      if (days.includes(DAY_IDS[d.getUTCDay()])) serviceDays++;
    }
    const trips = serviceDays * (r.returnTime ? 2 : 1);
    const kmPerTrip = Number(r.straightKm) * s.roadFactor;
    const totalKm = kmPerTrip * trips;

    const fuelKz = Math.round(totalKm * s.fuelCostPerKmKz);
    const driverKz = trips * s.driverPayPerTripKz;
    const maintenanceKz = Math.round(totalKm * s.maintenancePerKmKz);
    const insuranceDocsKz = s.insuranceDocsMonthlyKz;
    const otherKz = s.otherCostsMonthlyKz;
    const availabilityKz =
      r.modality === 'individual' ? Math.round((trips * (plan?.includedWaitMinutes ?? 0)) / 60 * s.availabilityPerHourKz) : 0;
    const routeCostKz = fuelKz + driverKz + maintenanceKz + insuranceDocsKz + otherKz + availabilityKz;

    const shared = r.modality === 'shared';
    const loaded = routeCostKz * (1 + (s.marginPercent + s.riskReservePercent) / 100);
    const seats = shared ? Number(r.passengerCount) : 1;
    const perSeat = (n: number) => (shared ? loaded / Math.max(1, n) : loaded);

    const currentOccupancy = Number(r.passengerCount);
    const targetOccupancy = opts.payingPassengers ?? plan?.minCapacity ?? currentOccupancy;
    const belowMinimum = shared && plan?.minCapacity != null && currentOccupancy < plan.minCapacity;

    const atTarget = perSeat(targetOccupancy) * seats;
    const atCurrent = perSeat(currentOccupancy) * seats;

    let suggested = ceil100(belowMinimum ? atCurrent : atTarget);
    if (s.minPriceKz > 0) suggested = Math.max(suggested, s.minPriceKz);
    if (s.maxPriceKz > 0) suggested = Math.min(suggested, s.maxPriceKz);
    // O minimo viavel nao leva o teto: o teto nao pode esconder uma perda.
    const minViable = Math.max(ceil100(atCurrent), s.minPriceKz);

    return {
      requestId: r.id,
      modality: r.modality,
      planId: plan?.id ?? null,
      planName: plan?.name ?? null,
      serviceDays,
      trips,
      kmPerTrip: Math.round(kmPerTrip * 10) / 10,
      totalKm: Math.round(totalKm),
      costs: { fuelKz, driverKz, maintenanceKz, insuranceDocsKz, otherKz, availabilityKz },
      routeCostKz,
      marginPercent: s.marginPercent,
      riskReservePercent: s.riskReservePercent,
      targetOccupancy,
      currentOccupancy,
      minCapacity: plan?.minCapacity ?? null,
      belowMinimum,
      suggestedPriceKz: suggested,
      minViablePriceKz: minViable,
      enforceViability: s.enforceViability,
    };
  }
}
