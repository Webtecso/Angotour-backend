import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { MonthlyPlan } from './entities/monthly-plan.entity';
import { MonthlyServiceRequest } from './entities/monthly-service-request.entity';
import { MonthlyContract } from './entities/monthly-contract.entity';
import { MonthlyExecution } from './entities/monthly-execution.entity';
import { MonthlyLedgerEntry } from './entities/monthly-ledger-entry.entity';
import { MonthlyPricingSettings } from './entities/monthly-pricing-settings.entity';
import { MonthlyService } from './monthly.service';
import { MonthlyExecutionsService } from './monthly-executions.service';
import { MonthlyPricingService } from './monthly-pricing.service';
import { MonthlyLedgerService } from './monthly-ledger.service';
import { MonthlyMaintenanceService } from './monthly-maintenance.service';
import { MonthlyController } from './monthly.controller';
import { MonthlyAdminController } from './monthly-admin.controller';
import { MonthlyDriverController } from './monthly-driver.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MonthlyPlan, MonthlyServiceRequest, MonthlyContract, MonthlyExecution, MonthlyLedgerEntry, MonthlyPricingSettings,
    ]),
    AdminAuthModule,
  ],
  controllers: [MonthlyController, MonthlyAdminController, MonthlyDriverController],
  providers: [MonthlyService, MonthlyExecutionsService, MonthlyPricingService, MonthlyLedgerService, MonthlyMaintenanceService],
  exports: [MonthlyService, MonthlyExecutionsService, MonthlyPricingService, MonthlyLedgerService],
})
export class MonthlyModule {}
