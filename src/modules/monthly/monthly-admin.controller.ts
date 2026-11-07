import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MonthlyService } from './monthly.service';
import { AdminAuditService } from '../admin-auth/admin-audit.service';
import { Roles } from '../admin-auth/roles.decorator';
import { RolesGuard } from '../admin-auth/roles.guard';
import { CreateMonthlyPlanDto } from './dto/create-monthly-plan.dto';
import { IssueProposalDto } from './dto/issue-proposal.dto';
import { AssignContractDto } from './dto/assign-contract.dto';
import { MonthlyExecutionsService } from './monthly-executions.service';
import { MonthlyPricingService } from './monthly-pricing.service';
import { MonthlyLedgerService } from './monthly-ledger.service';
import { MonthlyMaintenanceService } from './monthly-maintenance.service';
import { UpdateMonthlyPricingDto } from './dto/update-pricing-settings.dto';

/** AngoTour Mensal no painel. Login de admin (admin-jwt) + papel. O super_admin passa sempre. */
@Controller('admin/monthly')
@UseGuards(AuthGuard('admin-jwt'), RolesGuard)
@Roles('operations')
export class MonthlyAdminController {
  constructor(
    private readonly monthly: MonthlyService,
    private readonly audit: AdminAuditService,
    private readonly executions: MonthlyExecutionsService,
    private readonly pricing: MonthlyPricingService,
    private readonly ledgerSvc: MonthlyLedgerService,
    private readonly maintenance: MonthlyMaintenanceService,
  ) {}

  @Get('plans')
  plans() {
    return this.monthly.adminPlans();
  }

  @Post('plans')
  async createPlan(@Req() req: any, @Body() dto: CreateMonthlyPlanDto) {
    const plan = await this.monthly.createPlan(dto);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'monthly_plan_created',
      targetType: 'monthly_plan', targetId: plan.id, details: { name: plan.name, priceKz: plan.priceKz },
    });
    return plan;
  }

  @Get('requests')
  requests(@Query('status') status?: string) {
    return this.monthly.adminRequests(status);
  }

  @Get('contracts')
  contracts(@Query('status') status?: string) {
    return this.monthly.adminContracts(status);
  }

  @Post('proposals')
  async issue(@Req() req: any, @Body() dto: IssueProposalDto) {
    const c = await this.monthly.issueProposal(dto, req.user.email);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'monthly_proposal_issued',
      targetType: 'monthly_contract', targetId: c.id, details: { requestId: dto.requestId, priceKz: c.priceKz },
    });
    return c;
  }

  @Get('executions')
  listExecutions(@Query('date') date?: string, @Query('status') status?: string) {
    return this.executions.adminList({ date, status });
  }

  @Post('contracts/:id/executions')
  async generateExecutions(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const r = await this.executions.generateForContractId(id);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'monthly_executions_generated',
      targetType: 'monthly_contract', targetId: id, details: r,
    });
    return r;
  }

  @Get('quote')
  quote(@Query('requestId') requestId: string, @Query('planId') planId?: string, @Query('payingPassengers') paying?: string) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!requestId || !uuid.test(requestId)) throw new BadRequestException('Pedido invalido.');
    if (planId && !uuid.test(planId)) throw new BadRequestException('Plano invalido.');
    const n = paying ? Number(paying) : undefined;
    if (n !== undefined && (!Number.isInteger(n) || n < 1 || n > 15)) throw new BadRequestException('Numero de passageiros invalido.');
    return this.pricing.quote(requestId, { planId: planId || undefined, payingPassengers: n });
  }

  @Get('pricing-settings')
  pricingSettings() {
    return this.pricing.getSettings();
  }

  @Put('pricing-settings')
  async updatePricingSettings(@Req() req: any, @Body() dto: UpdateMonthlyPricingDto) {
    const s = await this.pricing.updateSettings(dto);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'monthly_pricing_settings_updated',
      targetType: 'monthly_pricing_settings', targetId: 'default', details: dto as Record<string, unknown>,
    });
    return s;
  }

﻿  @Post('maintenance/run')
  async runMaintenance(@Req() req: any) {
    const r = await this.maintenance.run();
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'monthly_maintenance_run',
      targetType: 'monthly_contract', targetId: 'maintenance', details: r,
    });
    return r;
  }

  @Get('finance')
  finance() {
    return this.ledgerSvc.summary();
  }

  @Post('contracts/:id/cancel')
  async cancelContract(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const c = await this.monthly.cancelContract(id, null);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'monthly_contract_cancelled',
      targetType: 'monthly_contract', targetId: id, details: { refundKz: c.refundKz ?? 0 },
    });
    return c;
  }

  @Get('ledger')
  ledgerList(@Query('contractId') contractId?: string) {
    return this.ledgerSvc.list(contractId);
  }

  @Get('eligible-drivers')
  eligibleDrivers() {
    return this.monthly.eligibleDrivers();
  }

  @Post('contracts/:id/payment/confirm')
  async confirmPayment(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const c = await this.monthly.adminConfirmPayment(id);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'monthly_payment_confirmed',
      targetType: 'monthly_contract', targetId: id, details: { simulated: true },
    });
    return c;
  }

  @Patch('contracts/:id/assign')
  async assign(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignContractDto) {
    const c = await this.monthly.assign(id, dto.driverId, dto.vehicleId);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'monthly_driver_assigned',
      targetType: 'monthly_contract', targetId: id, details: { driverId: dto.driverId, vehicleId: dto.vehicleId },
    });
    return c;
  }
}
