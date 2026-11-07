import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { MonthlyModality } from './monthly-plan.entity';

@Entity('monthly_service_requests')
export class MonthlyServiceRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  modality: MonthlyModality;

  @Column({ length: 160 })
  originLabel: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  originLocation: string;

  @Column({ length: 160 })
  destinationLabel: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  destinationLocation: string;

  // Dias preferidos, ex: ['mon','tue','wed','thu','fri']
  @Column({ type: 'simple-array', default: '' })
  preferredDays: string[];

  @Column({ type: 'time' })
  departureTime: string;

  @Column({ type: 'time', nullable: true })
  returnTime?: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'int', default: 1 })
  passengerCount: number;

  @Column({ type: 'text', nullable: true })
  specialNeeds?: string;

  // pending -> matching -> proposal_available -> accepted -> rejected -> expired
  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
