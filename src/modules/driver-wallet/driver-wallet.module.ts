import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverWalletEntry } from './entities/driver-wallet-entry.entity';
import { DriverWalletService } from './driver-wallet.service';
import { DriverWalletController } from './driver-wallet.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DriverWalletEntry])],
  controllers: [DriverWalletController],
  providers: [DriverWalletService],
  exports: [DriverWalletService],
})
export class DriverWalletModule {}
