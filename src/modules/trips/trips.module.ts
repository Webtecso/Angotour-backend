import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trip } from './entities/trip.entity';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { DriverTripsController } from './driver-trips.controller';
import { TrackingModule } from '../tracking/tracking.module';
import { DriverWalletModule } from '../driver-wallet/driver-wallet.module';
import { DriverDocumentsModule } from '../driver-documents/driver-documents.module';

@Module({
  imports: [TypeOrmModule.forFeature([Trip]), TrackingModule, DriverWalletModule, DriverDocumentsModule],
  controllers: [TripsController, DriverTripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
