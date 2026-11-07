import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MonthlyExecution } from './entities/monthly-execution.entity';
import { MonthlyContract } from './entities/monthly-contract.entity';
import { MonthlyServiceRequest } from './entities/monthly-service-request.entity';

const DAY_IDS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const EXEC_STATUSES = ['agendada', 'em_curso', 'concluida', 'cancelada'];

/** Data de hoje em Luanda (UTC+1), no formato AAAA-MM-DD. */
export const todayLuanda = () => new Date(Date.now() + 3600000).toISOString().slice(0, 10);

@Injectable()
export class MonthlyExecutionsService {
  constructor(
    @InjectRepository(MonthlyExecution) private readonly executions: Repository<MonthlyExecution>,
    @InjectRepository(MonthlyContract) private readonly contracts: Repository<MonthlyContract>,
    @InjectRepository(MonthlyServiceRequest) private readonly requests: Repository<MonthlyServiceRequest>,
  ) {}

  /** Gera os servicos do periodo do contrato. Idempotente: o que ja existe nao se duplica. */
  async generateForContractId(id: string): Promise<{ created: number; total: number }> {
    const c = await this.contracts.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Contrato nao encontrado.');
    if (c.status !== 'ativo' || !c.driverId || !c.vehicleId) {
      throw new BadRequestException('So se geram execucoes para contratos ativos com motorista e veiculo.');
    }
    const r = await this.requests.findOne({ where: { id: c.requestId } });
    if (!r) throw new NotFoundException('Pedido do contrato nao encontrado.');

    const raw: unknown = r.preferredDays;
    const days: string[] = Array.isArray(raw) ? (raw as string[]) : typeof raw === 'string' && raw ? raw.split(',') : [];

    const rows: Partial<MonthlyExecution>[] = [];
    const start = new Date(String(c.startDate).slice(0, 10) + 'T00:00:00Z');
    const end = new Date(String(c.endDate ?? c.startDate).slice(0, 10) + 'T00:00:00Z');
    for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      if (!days.includes(DAY_IDS[d.getUTCDay()])) continue;
      const date = d.toISOString().slice(0, 10);
      rows.push({ contractId: c.id, driverId: c.driverId, vehicleId: c.vehicleId, date, direction: 'ida', scheduledTime: String(r.departureTime).slice(0, 5), status: 'agendada' });
      if (r.returnTime) {
        rows.push({ contractId: c.id, driverId: c.driverId, vehicleId: c.vehicleId, date, direction: 'volta', scheduledTime: String(r.returnTime).slice(0, 5), status: 'agendada' });
      }
    }
    if (rows.length === 0) return { created: 0, total: 0 };

    const before = await this.executions.count({ where: { contractId: c.id } });
    await this.executions.createQueryBuilder().insert().into(MonthlyExecution).values(rows as any).orIgnore().execute();
    const total = await this.executions.count({ where: { contractId: c.id } });
    return { created: total - before, total };
  }

  // ---------------- Motorista ----------------

  driverUpcoming(driverId: string) {
    return this.executions.query(
      `SELECT e.id, e.date::text AS date, e.direction, e."scheduledTime", e.status, e."startedAt", e."completedAt",
              r."originLabel", r."destinationLabel", r."passengerCount",
              split_part(u."fullName", ' ', 1) AS "passengerFirstName"
       FROM monthly_executions e
       JOIN monthly_contracts c ON c.id = e."contractId"
       JOIN monthly_service_requests r ON r.id = c."requestId"
       LEFT JOIN users u ON u.id = c."userId"
       WHERE e."driverId" = $1
         AND (e.status = 'em_curso' OR (e.status = 'agendada' AND e.date BETWEEN $2::date AND $2::date + 7))
       ORDER BY e.date ASC, e."scheduledTime" ASC LIMIT 100`,
      [driverId, todayLuanda()],
    );
  }

  private async mine(driverId: string, id: string): Promise<MonthlyExecution> {
    const e = await this.executions.findOne({ where: { id, driverId } });
    if (!e) throw new NotFoundException('Servico nao encontrado.');
    return e;
  }

  async start(driverId: string, id: string): Promise<MonthlyExecution> {
    const e = await this.mine(driverId, id);
    if (e.status === 'em_curso' || e.status === 'concluida') return e;
    if (e.status !== 'agendada') throw new BadRequestException('Este servico ja nao pode ser iniciado.');
    if (String(e.date).slice(0, 10) !== todayLuanda()) throw new BadRequestException('So podes iniciar um servico no proprio dia.');
    e.status = 'em_curso';
    e.startedAt = new Date();
    return this.executions.save(e);
  }

  async complete(driverId: string, id: string): Promise<MonthlyExecution> {
    const e = await this.mine(driverId, id);
    if (e.status === 'concluida') return e;
    if (e.status !== 'em_curso') throw new BadRequestException('Inicia o servico antes de o concluir.');
    e.status = 'concluida';
    e.completedAt = new Date();
    return this.executions.save(e);
  }

  // ---------------- Admin ----------------

  adminList(filters: { date?: string; status?: string }) {
    const date = filters.date && /^\d{4}-\d{2}-\d{2}$/.test(filters.date) ? filters.date : null;
    const status = filters.status && EXEC_STATUSES.includes(filters.status) ? filters.status : null;
    return this.executions.query(
      `SELECT e.id, e."contractId", e.date::text AS date, e.direction, e."scheduledTime", e.status, e."startedAt", e."completedAt",
              r."originLabel", r."destinationLabel", u."fullName" AS "userFullName",
              d."fullName" AS "driverName", v.plate AS "vehiclePlate"
       FROM monthly_executions e
       JOIN monthly_contracts c ON c.id = e."contractId"
       JOIN monthly_service_requests r ON r.id = c."requestId"
       LEFT JOIN users u ON u.id = c."userId"
       LEFT JOIN drivers d ON d.id = e."driverId"
       LEFT JOIN vehicles v ON v.id = e."vehicleId"
       WHERE ($1::date IS NULL OR e.date = $1::date) AND ($2::text IS NULL OR e.status = $2)
       ORDER BY e.date ASC, e."scheduledTime" ASC LIMIT 300`,
      [date, status],
    );
  }
}
