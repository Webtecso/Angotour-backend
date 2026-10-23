import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminFinanceService } from './admin-finance.service';
import { Roles } from '../admin-auth/roles.decorator';
import { RolesGuard } from '../admin-auth/roles.guard';

@Controller('admin/finance')
@UseGuards(AuthGuard('admin-jwt'), RolesGuard)
@Roles('finance')
export class AdminFinanceController {
  constructor(private readonly finance: AdminFinanceService) {}

  @Get('overview')
  overview() {
    return this.finance.overview();
  }

  @Get('wallets')
  wallets(@Query('q') q?: string) {
    return this.finance.wallets(q);
  }

  @Get('wallets/:id')
  walletDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.finance.walletDetail(id);
  }
}
