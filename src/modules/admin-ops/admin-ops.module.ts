import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { DriverDocumentsModule } from '../driver-documents/driver-documents.module';
import { DriverWalletModule } from '../driver-wallet/driver-wallet.module';
import { AdminOpsController } from './admin-ops.controller';
import { AdminOpsService } from './admin-ops.service';

@Module({
  imports: [AdminAuthModule, DriverDocumentsModule, DriverWalletModule],
  controllers: [AdminOpsController],
  providers: [AdminOpsService],
})
export class AdminOpsModule {}
