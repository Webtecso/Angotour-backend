import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { CommissionPlansController } from './commission-plans.controller';

@Module({
  imports: [AdminAuthModule],
  controllers: [CommissionPlansController],
})
export class CommissionPlansModule {}
