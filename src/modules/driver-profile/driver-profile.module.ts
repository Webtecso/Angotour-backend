import { Module } from '@nestjs/common';
import { DriverProfileController } from './driver-profile.controller';
import { DriverProfileService } from './driver-profile.service';

@Module({
  controllers: [DriverProfileController],
  providers: [DriverProfileService],
})
export class DriverProfileModule {}
