import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rating } from './entities/rating.entity';
import { FavoriteDriver } from './entities/favorite-driver.entity';
import { DriverFeedbackService } from './driver-feedback.service';
import { DriverFeedbackController } from './driver-feedback.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Rating, FavoriteDriver])],
  controllers: [DriverFeedbackController],
  providers: [DriverFeedbackService],
})
export class DriverFeedbackModule {}
