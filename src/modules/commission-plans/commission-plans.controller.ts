import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DataSource } from 'typeorm';
import { AdminAuditService } from '../admin-auth/admin-audit.service';
import { Roles } from '../admin-auth/roles.decorator';
import { RolesGuard } from '../admin-auth/roles.guard';
import { COMMISSION_PLANS, commissionRateFor } from '../../common/commission-plans';
import { SetCommissionPlanDto } from './dto/set-commission-plan.dto';

/** Planos de comissao dos motoristas. Login de admin + papel operations. */
@Controller('admin/commission')
@UseGuards(AuthGuard('admin-jwt'), RolesGuard)
@Roles('operations')
export class CommissionPlansController {
  constructor(private readonly db: DataSource, private readonly audit: AdminAuditService) {}

  @Get('plans')
  plans() {
    return COMMISSION_PLANS.map((p) => ({ plan: p, ratePercent: Math.round(commissionRateFor(p) * 10000) / 100 }));
  }

  @Patch('drivers/:id')
  async setPlan(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetCommissionPlanDto) {
    const rows = await this.db.query(
      `UPDATE drivers SET "commissionPlan" = $1 WHERE id = $2 RETURNING id, "fullName", "commissionPlan"`,
      [dto.plan, id],
    );
    if (!rows[0]) throw new NotFoundException('Motorista nao encontrado.');
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'driver_commission_plan_changed',
      targetType: 'driver', targetId: id, details: { plan: dto.plan },
    });
    return rows[0];
  }
}
