import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Associacao frota -> veiculo. Um veiculo so pode estar numa frota. */
@Entity('fleet_vehicles')
export class FleetVehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  fleetId: string;

  @Index({ unique: true })
  @Column('uuid')
  vehicleId: string;

  @CreateDateColumn()
  createdAt: Date;
}
