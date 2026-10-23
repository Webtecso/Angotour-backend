import { Module } from '@nestjs/common';
import { AdminFinanceService } from './admin-finance.service';
import { AdminFinanceController } from './admin-finance.controller';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { DriverWalletModule } from '../driver-wallet/driver-wallet.module';

@Module({
  imports: [AdminAuthModule, DriverWalletModule],
  controllers: [AdminFinanceController],
  providers: [AdminFinanceService],
})
export class AdminFinanceModule {}
