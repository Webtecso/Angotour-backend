import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceChange } from './entities/price-change.entity';
import { PriceChangesService } from './price-changes.service';
import { PriceChangesController } from './price-changes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PriceChange])],
  controllers: [PriceChangesController],
  providers: [PriceChangesService],
})
export class PriceChangesModule {}
