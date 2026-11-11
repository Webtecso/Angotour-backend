import { Module } from '@nestjs/common';
import { DriverExtrasController } from './driver-extras.controller';
import { DriverExtrasService } from './driver-extras.service';

@Module({ controllers: [DriverExtrasController], providers: [DriverExtrasService] })
export class DriverExtrasModule {}