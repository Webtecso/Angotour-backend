import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { PricingRule } from './entities/pricing-rule.entity';
import { PlatformSetting } from './entities/platform-setting.entity';
import { SettingsHistory } from './entities/settings-history.entity';
import { PricingService } from './pricing.service';
import { PricingAdminController, PricingPublicController } from './pricing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PricingRule, PlatformSetting, SettingsHistory]), AdminAuthModule],
  controllers: [PricingPublicController, PricingAdminController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
