import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleInspection } from './entities/vehicle-inspection.entity';

/** Regista a entidade das inspecoes para o TypeORM a carregar (as queries do painel usam SQL cru). */
@Module({
  imports: [TypeOrmModule.forFeature([VehicleInspection])],
  exports: [TypeOrmModule],
})
export class VehicleInspectionsModule {}
