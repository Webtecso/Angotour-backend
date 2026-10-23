import { Column, CreateDateColumn, Entity, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';
import { Trip } from '../../trips/entities/trip.entity';

export enum DriverStatus {
  OFFLINE = 'offline',
  ONLINE = 'online',
  ON_TRIP = 'on_trip',
}

@Entity('drivers')
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  fullName: string;

  @Column({ unique: true, length: 20 })
  phone: string;

  @Column({ nullable: true })
  photoUrl?: string;

  @Column({ type: 'float', default: 5.0 })
  rating: number;

  @Column({ type: 'enum', enum: DriverStatus, default: DriverStatus.OFFLINE })
  status: DriverStatus;

  // Coluna geografica PostGIS (GeoJSON Point, SRID 4326 = WGS84 / GPS padrao).
  // Permite consultas tipo "motoristas num raio de 5km" com ST_DWithin.
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  currentLocation?: string;

  @Column({ default: false })
  isVerified: boolean;

  // Modo Ela: permite priorizar motorista mulher no matching
  @Column({ type: 'varchar', length: 10, default: 'male' })
  gender: string;

  @OneToOne(() => Vehicle, (vehicle) => vehicle.driver)
  vehicle?: Vehicle;

  @OneToMany(() => Trip, (trip) => trip.driver)
  trips: Trip[];

  @CreateDateColumn()
  createdAt: Date;
}
