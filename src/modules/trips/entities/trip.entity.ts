import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Driver } from '../../drivers/entities/driver.entity';
import { VehicleCategoryId } from '../../../common/vehicle-category.enum';

export enum TripStatus {
  SEARCHING_DRIVER = 'searching_driver',
  DRIVER_ASSIGNED = 'driver_assigned',
  DRIVER_ARRIVING = 'driver_arriving',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface TripPoint {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  reference?: string;
}

@Entity('trips')
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.trips)
  passenger: User;

  @ManyToOne(() => Driver, (driver) => driver.trips, { nullable: true })
  driver?: Driver;

  @Column({ type: 'enum', enum: VehicleCategoryId })
  categoryId: VehicleCategoryId;

  @Column('jsonb')
  origin: TripPoint;

  @Column('jsonb')
  destination: TripPoint;

  @Column({ type: 'float' })
  distanceKm: number;

  @Column({ type: 'int' })
  etaMinutes: number;

  // Preco protegido: calculado uma unica vez em create() e nunca alterado depois.
  @Column({ type: 'int' })
  priceKz: number;

  @Column({ type: 'jsonb', nullable: true })
  priceBreakdown?: any;

  @Column({ type: 'enum', enum: TripStatus, default: TripStatus.SEARCHING_DRIVER })
  status: TripStatus;

  @Column({ nullable: true, length: 6 })
  boardingCode?: string;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledFor?: Date;

  @Column({ type: 'varchar', length: 30, default: 'wallet' })
  paymentMethodType: string;

  @Column({ type: 'int', nullable: true })
  cashNoteKz?: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  cancelReason?: string;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date;

  // Preenchido quando o motorista introduz o codigo de embarque certo.
  @Column({ type: 'timestamptz', nullable: true })
  boardingConfirmedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ type: 'float', nullable: true })
  actualDistanceKm?: number;

  @Column({ type: 'jsonb', nullable: true })
  comfortPreferences?: string[];

  @Column({ type: 'int', nullable: true })
  splitCount?: number;

  @Column({ type: 'jsonb', nullable: true })
  airportPickup?: { terminal: string; pickupPoint: string };

  @Column({ type: 'boolean', default: false })
  womenMode: boolean;

  @Column({ type: 'int', nullable: true })
  changeKz?: number;

  @CreateDateColumn()
  createdAt: Date;
}



