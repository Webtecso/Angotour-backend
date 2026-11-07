import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MonthlyPlan } from './entities/monthly-plan.entity';
import { MonthlyServiceRequest } from './entities/monthly-service-request.entity';
import { MonthlyContract } from './entities/monthly-contract.entity';
import { CreateMonthlyPlanDto } from './dto/create-monthly-plan.dto';
import { CreateMonthlyRequestDto } from './dto/create-monthly-request.dto';
import { IssueProposalDto } from './dto/issue-proposal.dto';
import { MonthlyExecutionsService, todayLuanda } from './monthly-executions.service';
import { MonthlyLedgerService } from './monthly-ledger.service';
import { MonthlyPricingService, MonthlyQuote } from './monthly-pricing.service';

// Contratos que ainda "ocupam" um pedido: nao se emite outra proposta para o mesmo pedido.
const OPEN_STATUSES = ['proposta_emitida', 'aguardando_pagamento', 'pago', 'aguardando_atribuicao', 'ativo'];
const PAID_STATUSES = ['pago', 'aguardando_atribuicao', 'ativo'];

const REQUEST_STATUSES = ['pending', 'matching', 'proposal_available', 'accepted', 'rejected', 'expired'];
const CONTRACT_STATUSES = [
  'proposta_emitida', 'aguardando_pagamento', 'pago', 'aguardando_atribuicao', 'ativo',
  'suspenso', 'em_renovacao', 'concluido', 'cancelado', 'reembolsado',
];

@Injectable()
export class MonthlyService {
  constructor(
    @InjectRepository(MonthlyPlan)
    private readonly plansRepository: Repository<MonthlyPlan>,
    @InjectRepository(MonthlyServiceRequest)
    private readonly requestsRepository: Repository<MonthlyServiceRequest>,
    @InjectRepository(MonthlyContract)
    private readonly contractsRepository: Repository<MonthlyContract>,
    private readonly executions: MonthlyExecutionsService,
    private readonly pricing: MonthlyPricingService,
    private readonly ledger: MonthlyLedgerService,
  ) {}

  // ---------------- Passageiro ----------------

  findActivePlans(): Promise<MonthlyPlan[]> {
    return this.plansRepository.find({ where: { active: true }, order: { priceKz: 'ASC' } });
  }

  createRequest(userId: string, dto: CreateMonthlyRequestDto): Promise<MonthlyServiceRequest> {
    if (String(dto.startDate).slice(0, 10) < todayLuanda()) {
      throw new BadRequestException('A data de inicio nao pode ser anterior a hoje.');
    }
    const request = this.requestsRepository.create({
      userId,
      modality: dto.modality,
      originLabel: dto.originLabel,
      originLocation: `SRID=4326;POINT(${dto.originLongitude} ${dto.originLatitude})`,
      destinationLabel: dto.destinationLabel,
      destinationLocation: `SRID=4326;POINT(${dto.destinationLongitude} ${dto.destinationLatitude})`,
      preferredDays: dto.preferredDays,
      departureTime: dto.departureTime,
      returnTime: dto.returnTime,
      startDate: dto.startDate,
      passengerCount: dto.passengerCount ?? 1,
      specialNeeds: dto.specialNeeds,
      status: 'pending',
    });
    return this.requestsRepository.save(request);
  }

  findMyRequests(userId: string): Promise<MonthlyServiceRequest[]> {
    return this.requestsRepository.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  findMyContracts(userId: string): Promise<MonthlyContract[]> {
    return this.contractsRepository.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async findOneContract(userId: string, id: string): Promise<MonthlyContract> {
    const contract = await this.contractsRepository.findOne({ where: { id, userId } });
    if (!contract) throw new NotFoundException('Contrato nao encontrado.');
    return contract;
  }

  private isExpired(c: MonthlyContract): boolean {
    return !!c.proposalExpiresAt && new Date(c.proposalExpiresAt).getTime() < Date.now();
  }

  /** Aceita a proposta (com as condicoes) e emite a referencia de pagamento. Idempotente. */
  async acceptProposal(userId: string, id: string): Promise<MonthlyContract> {
    const c = await this.findOneContract(userId, id);
    if (c.status === 'aguardando_pagamento' || PAID_STATUSES.includes(c.status)) return c;
    if (c.status !== 'proposta_emitida') throw new BadRequestException('Esta proposta ja nao esta disponivel.');
    if (this.isExpired(c)) {
      c.status = 'cancelado';
      await this.contractsRepository.save(c);
      await this.requestsRepository.update(c.requestId, { status: 'expired' });
      throw new BadRequestException('A proposta expirou. Pede uma nova.');
    }
    c.conditionsAccepted = true;
    c.status = 'aguardando_pagamento';
    c.paymentReference = `9${Math.floor(10000000 + Math.random() * 89999999)}`;
    const saved = await this.contractsRepository.save(c);
    await this.requestsRepository.update(c.requestId, { status: 'accepted' });
    return saved;
  }

  async rejectProposal(userId: string, id: string): Promise<MonthlyContract> {
    const c = await this.findOneContract(userId, id);
    if (c.status === 'cancelado') return c;
    if (c.status !== 'proposta_emitida') throw new BadRequestException('So podes rejeitar uma proposta ainda por aceitar.');
    c.status = 'cancelado';
    const saved = await this.contractsRepository.save(c);
    await this.requestsRepository.update(c.requestId, { status: 'rejected' });
    return saved;
  }

  /**
   * SO DESENVOLVIMENTO: simula a confirmacao do pagamento. Exige ALLOW_DEV_TOPUP_CONFIRM=true.
   * Em producao a confirmacao vem de um webhook assinado do prestador de pagamentos.
   * Idempotente: confirmar duas vezes nao altera nada.
   */
  async devConfirmPayment(userId: string, id: string): Promise<MonthlyContract> {
    if (process.env.ALLOW_DEV_TOPUP_CONFIRM !== 'true') throw new ForbiddenException();
    const c = await this.findOneContract(userId, id);
    if (PAID_STATUSES.includes(c.status)) return c;
    if (c.status !== 'aguardando_pagamento') throw new BadRequestException('O contrato nao esta a aguardar pagamento.');
    c.paidAt = new Date();
    c.status = 'aguardando_atribuicao';
    const saved = await this.contractsRepository.save(c);
    await this.ledger.recordPayment(saved);
    return saved;
  }

  // ---------------- Admin ----------------

  createPlan(dto: CreateMonthlyPlanDto): Promise<MonthlyPlan> {
    const plan = this.plansRepository.create({
      name: dto.name,
      modality: dto.modality,
      weeklyFrequency: dto.weeklyFrequency ?? 5,
      tripsPerDay: dto.tripsPerDay ?? 2,
      includedKm: dto.includedKm,
      includedWaitMinutes: dto.includedWaitMinutes ?? 0,
      minCapacity: dto.minCapacity,
      maxCapacity: dto.maxCapacity,
      priceKz: dto.priceKz,
      conditions: dto.conditions ?? '',
    });
    return this.plansRepository.save(plan);
  }

  adminPlans(): Promise<MonthlyPlan[]> {
    return this.plansRepository.find({ order: { createdAt: 'DESC' } });
  }

  async adminRequests(status?: string) {
    const s = status && REQUEST_STATUSES.includes(status) ? status : null;
    const rows = await this.requestsRepository.query(
      `SELECT r.id, r."userId", r.modality, r."originLabel", r."destinationLabel", r."preferredDays",
              r."departureTime", r."returnTime", r."startDate", r."passengerCount", r."specialNeeds",
              r.status, r."createdAt", u."fullName" AS "userFullName", u.phone AS "userPhone"
       FROM monthly_service_requests r LEFT JOIN users u ON u.id = r."userId"
       WHERE ($1::text IS NULL OR r.status = $1)
       ORDER BY r."createdAt" DESC LIMIT 300`,
      [s],
    );
    return rows.map((r: any) => ({
      ...r,
      preferredDays: typeof r.preferredDays === 'string' && r.preferredDays ? r.preferredDays.split(',') : [],
    }));
  }

  adminContracts(status?: string) {
    const s = status && CONTRACT_STATUSES.includes(status) ? status : null;
    return this.contractsRepository.query(
      `SELECT c.id, c."requestId", c.modality, c."priceKz", c."startDate", c."endDate", c.status,
              c."paymentReference", c."paidAt", c."proposalExpiresAt", c."createdAt", c."driverId", c."vehicleId",
              u."fullName" AS "userFullName", u.phone AS "userPhone",
              d."fullName" AS "driverName", v.plate AS "vehiclePlate"
       FROM monthly_contracts c
       LEFT JOIN users u ON u.id = c."userId"
       LEFT JOIN drivers d ON d.id = c."driverId"
       LEFT JOIN vehicles v ON v.id = c."vehicleId"
       WHERE ($1::text IS NULL OR c.status = $1)
       ORDER BY c."createdAt" DESC LIMIT 300`,
      [s],
    );
  }

  private endDateFor(start: string): string {
    const d = new Date(String(start).slice(0, 10) + 'T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  /** Emite a proposta de preco para um pedido. O preco fica fixo no contrato. */
  async issueProposal(dto: IssueProposalDto, adminEmail: string | null): Promise<MonthlyContract> {
    const request = await this.requestsRepository.findOne({ where: { id: dto.requestId } });
    if (!request) throw new NotFoundException('Pedido nao encontrado.');

    const open = await this.contractsRepository.findOne({ where: { requestId: request.id, status: In(OPEN_STATUSES) } });
    if (open) throw new BadRequestException('Este pedido ja tem uma proposta ou contrato em curso.');

    let plan: MonthlyPlan | null = null;
    if (dto.planId) {
      plan = await this.plansRepository.findOne({ where: { id: dto.planId, active: true } });
      if (!plan) throw new NotFoundException('Plano nao encontrado.');
      if (plan.modality !== request.modality) {
        throw new BadRequestException('O plano nao corresponde a modalidade do pedido.');
      }
    }
    let quote: MonthlyQuote | null = null;
    try {
      quote = await this.pricing.quote(request.id, { planId: plan?.id });
    } catch {
      quote = null;
    }
    const priceKz = dto.priceKz ?? plan?.priceKz ?? quote?.suggestedPriceKz;
    if (!priceKz || priceKz <= 0) throw new BadRequestException('Indica o preco ou escolhe um plano.');
    const belowViable = !!quote && priceKz < quote.minViablePriceKz;
    if (belowViable && quote?.enforceViability && !dto.subsidyAuthorized) {
      throw new BadRequestException('Preco abaixo do minimo viavel (' + quote.minViablePriceKz + ' Kz). Autoriza o subsidio para emitir.');
    }

    const expires = new Date(Date.now() + (dto.validDays ?? 3) * 24 * 60 * 60 * 1000);
    const contract = this.contractsRepository.create({
      requestId: request.id,
      userId: request.userId,
      modality: request.modality,
      planId: plan?.id,
      priceKz,
      startDate: request.startDate,
      endDate: this.endDateFor(request.startDate),
      status: 'proposta_emitida',
      conditionsAccepted: false,
      proposalExpiresAt: expires,
      priceBreakdown: {
        planId: plan?.id ?? null,
        planName: plan?.name ?? null,
        planPriceKz: plan?.priceKz ?? null,
        finalPriceKz: priceKz,
        quote,
        viable: !belowViable,
        subsidized: belowViable,
        subsidyLossKz: belowViable && quote ? quote.minViablePriceKz - priceKz : 0,
        subsidyAuthorizedBy: belowViable ? adminEmail : null,
        issuedBy: adminEmail,
        issuedAt: new Date().toISOString(),
      },
    });
    const saved = await this.contractsRepository.save(contract);
    await this.requestsRepository.update(request.id, { status: 'proposal_available' });
    return saved;
  }

  /** SO DESENVOLVIMENTO (ALLOW_DEV_TOPUP_CONFIRM=true): confirma o pagamento pelo painel. Idempotente. */
  async adminConfirmPayment(id: string): Promise<MonthlyContract> {
    if (process.env.ALLOW_DEV_TOPUP_CONFIRM !== 'true') throw new ForbiddenException();
    const c = await this.contractsRepository.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Contrato nao encontrado.');
    if (PAID_STATUSES.includes(c.status)) return c;
    if (c.status !== 'aguardando_pagamento') throw new BadRequestException('O contrato nao esta a aguardar pagamento.');
    c.paidAt = new Date();
    c.status = 'aguardando_atribuicao';
    const saved = await this.contractsRepository.save(c);
    await this.ledger.recordPayment(saved);
    return saved;
  }

  /** Motoristas com veiculo aprovado, para a atribuicao. */
  eligibleDrivers() {
    return this.contractsRepository.query(
      `SELECT d.id AS "driverId", d."fullName", d.phone, v.id AS "vehicleId", v.plate, v.model
       FROM vehicles v JOIN drivers d ON d.id = v."driverId"
       WHERE v.status = 'approved' ORDER BY d."fullName" ASC LIMIT 300`,
    );
  }

﻿  /** Quanto se reembolsa se o contrato for cancelado agora. */
  private async cancelCalc(c: MonthlyContract): Promise<{ refundKz: number; remaining: number; total: number }> {
    if (!PAID_STATUSES.includes(c.status)) return { refundKz: 0, remaining: 0, total: 0 };
    const rows = await this.contractsRepository.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'agendada' AND "date" >= $2::date)::int AS remaining
       FROM monthly_executions WHERE "contractId" = $1`,
      [c.id, todayLuanda()],
    );
    const total = Number(rows[0]?.total ?? 0);
    const remaining = Number(rows[0]?.remaining ?? 0);
    const refundKz = total === 0 ? c.priceKz : Math.round((c.priceKz * remaining) / total);
    return { refundKz, remaining, total };
  }

  async cancelPreview(userId: string, id: string) {
    const c = await this.findOneContract(userId, id);
    if (c.status === 'cancelado') return { refundKz: c.refundKz ?? 0, remaining: 0, total: 0 };
    return this.cancelCalc(c);
  }

  /** Cancela o contrato. userId = null quando e o admin. Idempotente. */
  async cancelContract(id: string, userId: string | null): Promise<MonthlyContract> {
    const c = userId ? await this.findOneContract(userId, id) : await this.contractsRepository.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Contrato nao encontrado.');
    if (c.status === 'cancelado') return c;
    if (!['proposta_emitida', 'aguardando_pagamento', ...PAID_STATUSES].includes(c.status)) {
      throw new BadRequestException('Este contrato ja nao pode ser cancelado.');
    }
    const calc = await this.cancelCalc(c);
    c.status = 'cancelado';
    c.cancelledAt = new Date();
    c.refundKz = calc.refundKz;
    const saved = await this.contractsRepository.save(c);
    await this.contractsRepository.query(
      `UPDATE monthly_executions SET status = 'cancelada' WHERE "contractId" = $1 AND status = 'agendada' AND "date" >= $2::date`,
      [saved.id, todayLuanda()],
    );
    if (calc.refundKz > 0) await this.ledger.recordRefund(saved, calc.refundKz);
    return saved;
  }

  /** Renovacao: contrato novo para o periodo seguinte, ao mesmo preco, a aceitar e pagar de novo. Idempotente. */
  async renewContract(userId: string, id: string): Promise<MonthlyContract> {
    const c = await this.findOneContract(userId, id);
    if (c.status !== 'ativo') throw new BadRequestException('So se renovam contratos ativos.');
    const end = String(c.endDate ?? c.startDate).slice(0, 10);
    const limit = new Date(Date.now() + 3600000 + 7 * 86400000).toISOString().slice(0, 10);
    if (end > limit) throw new BadRequestException('A renovacao abre 7 dias antes do fim do contrato.');
    const existing = await this.contractsRepository.findOne({ where: { renewedFromId: c.id, status: In(OPEN_STATUSES) } });
    if (existing) return existing;
    const d = new Date(end + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    const newStart = d.toISOString().slice(0, 10);
    const created = this.contractsRepository.create({
      requestId: c.requestId,
      userId: c.userId,
      modality: c.modality,
      planId: c.planId,
      priceKz: c.priceKz,
      startDate: newStart,
      endDate: this.endDateFor(newStart),
      status: 'proposta_emitida',
      conditionsAccepted: false,
      proposalExpiresAt: new Date(Date.now() + 3 * 86400000),
      renewedFromId: c.id,
      priceBreakdown: { renewalOf: c.id, finalPriceKz: c.priceKz, note: 'Renovacao ao mesmo preco', issuedAt: new Date().toISOString() },
    });
    return this.contractsRepository.save(created);
  }

  /** Atribui motorista e veiculo a um contrato pago. O veiculo tem de estar aprovado e ser do motorista. */
  async assign(id: string, driverId: string, vehicleId: string): Promise<MonthlyContract> {
    const c = await this.contractsRepository.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Contrato nao encontrado.');
    if (c.status === 'ativo' && c.driverId === driverId && c.vehicleId === vehicleId) {
      await this.ledger.recordDriverPayable(c);
      return c;
    }
    if (c.status !== 'aguardando_atribuicao') {
      throw new BadRequestException('So se atribui motorista a contratos pagos a aguardar atribuicao.');
    }
    const ok = await this.contractsRepository.query(
      `SELECT 1 FROM vehicles WHERE id = $1 AND "driverId" = $2 AND status = 'approved' LIMIT 1`,
      [vehicleId, driverId],
    );
    if (!ok[0]) throw new BadRequestException('O veiculo tem de estar aprovado e pertencer a esse motorista.');
    c.driverId = driverId;
    c.vehicleId = vehicleId;
    c.status = 'ativo';
    const saved = await this.contractsRepository.save(c);
    await this.ledger.recordDriverPayable(saved);
    try {
      await this.executions.generateForContractId(saved.id);
    } catch (e) {
      // O contrato fica ativo; as execucoes podem ser geradas depois pelo painel.
      console.warn('[Monthly] nao foi possivel gerar as execucoes:', (e as Error).message);
    }
    return saved;
  }
}
