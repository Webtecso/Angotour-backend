import { Module } from '@nestjs/common';
import { SupportModule } from '../support/support.module';
import { DriverSafetyController } from './driver-safety.controller';

@Module({
  imports: [SupportModule],
  controllers: [DriverSafetyController],
})
export class DriverSafetyModule {}
