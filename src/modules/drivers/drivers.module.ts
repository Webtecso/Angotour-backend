import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from './entities/driver.entity';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';
import { DriverWalletModule } from '../driver-wallet/driver-wallet.module';
import { DriverDocumentsModule } from '../driver-documents/driver-documents.module';

@Module({
  imports: [TypeOrmModule.forFeature([Driver]), DriverWalletModule, DriverDocumentsModule],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
