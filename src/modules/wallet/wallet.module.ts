import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletTopUp } from './entities/wallet-topup.entity';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [TypeOrmModule.forFeature([WalletTopUp])],
  controllers: [WalletController],
  providers: [WalletService],
})
export class WalletModule {}
