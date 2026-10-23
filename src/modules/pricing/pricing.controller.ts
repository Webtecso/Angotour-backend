import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PricingService } from './pricing.service';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { AdminAuditService } from '../admin-auth/admin-audit.service';
import { Roles } from '../admin-auth/roles.decorator';
import { RolesGuard } from '../admin-auth/roles.guard';

/** Publico: as tarifas atuais, para a estimativa de preco na app do passageiro. */
@Controller('pricing')
export class PricingPublicController {
  constructor(private readonly pricing: PricingService) {}

  @Get()
  list() {
    return this.pricing.publicPricing();
  }
}

/** Painel: so finance e super_admin. Cada alteracao fica no historico e na auditoria. */
@Controller('admin/settings')
@UseGuards(AuthGuard('admin-jwt'), RolesGuard)
export class PricingAdminController {
  constructor(
    private readonly pricing: PricingService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  @Roles('finance')
  overview() {
    return this.pricing.overview();
  }

  @Patch('commission')
  @Roles('finance')
  async commission(@Req() req: any, @Body() dto: UpdateCommissionDto) {
    const r = await this.pricing.updateCommission(dto.percent, { adminId: req.user.adminId, adminEmail: req.user.email });
    if (r.changed) {
      await this.audit.record({
        adminId: req.user.adminId, adminEmail: req.user.email, action: 'commission_changed',
        targetType: 'setting', targetId: 'commission_rate', details: { from: r.from, to: r.to },
      });
    }
    return r;
  }

  @Patch('pricing/:categoryId')
  @Roles('finance')
  async updatePricing(@Req() req: any, @Param('categoryId') categoryId: string, @Body() dto: UpdatePricingDto) {
    const r = await this.pricing.updatePricing(categoryId, dto, { adminId: req.user.adminId, adminEmail: req.user.email });
    if (r.changed) {
      await this.audit.record({
        adminId: req.user.adminId, adminEmail: req.user.email, action: 'pricing_changed',
        targetType: 'pricing', targetId: categoryId, details: { before: r.before, after: r.after },
      });
    }
    return r;
  }
}
