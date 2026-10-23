import { Module } from '@nestjs/common';
import { TripEventsModule } from '../trip-events/trip-events.module';
import { CancellationsModule } from '../cancellations/cancellations.module';
import { FavoritesModule } from '../favorites/favorites.module';
import { FamilyModule } from '../family/family.module';
import { RewardsModule } from '../rewards/rewards.module';
import { DriverFeedbackModule } from '../driver-feedback/driver-feedback.module';
import { PriceChangesModule } from '../price-changes/price-changes.module';

@Module({
  imports: [
    TripEventsModule,
    CancellationsModule,
    FavoritesModule,
    FamilyModule,
    RewardsModule,
    DriverFeedbackModule,
    PriceChangesModule,
  ],
})
export class ExtrasModule {}
