import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { DriverVehicleService } from './driver-vehicle.service';
import { DriverVehicleController } from './driver-vehicle.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle])],
  controllers: [DriverVehicleController],
  providers: [DriverVehicleService],
  exports: [DriverVehicleService],
})
export class DriverVehicleModule {}
