import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from './entities/agent.entity';
import { AgentDriver } from './entities/agent-driver.entity';
import { Owner } from './entities/owner.entity';
import { Fleet } from './entities/fleet.entity';
import { FleetVehicle } from './entities/fleet-vehicle.entity';

/** Regista as entidades dos parceiros no TypeORM. O acesso e feito por SQL no AdminOpsService. */
@Module({
  imports: [TypeOrmModule.forFeature([Agent, AgentDriver, Owner, Fleet, FleetVehicle])],
})
export class PartnersModule {}
