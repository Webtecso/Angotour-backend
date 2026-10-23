import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RewardRedemption } from './entities/reward-redemption.entity';
import { RewardsService } from './rewards.service';
import { RewardsController } from './rewards.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RewardRedemption])],
  controllers: [RewardsController],
  providers: [RewardsService],
})
export class RewardsModule {}
