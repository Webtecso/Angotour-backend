import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type CertificationStatus = 'certified' | 'failed';

@Entity('vehicle_inspections')
export class VehicleInspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  vehicleId: string;

  @Column({ length: 120 })
  inspectorName: string;

  @Column({ default: true })
  tiresOk: boolean;

  @Column({ default: true })
  brakesOk: boolean;

  @Column({ default: true })
  lightsOk: boolean;

  @Column({ default: true })
  acOk: boolean;

  @Column({ default: true })
  documentationOk: boolean;

  @Column({ type: 'varchar', length: 20, default: 'certified' })
  status: CertificationStatus;

  @Column({ type: 'varchar', length: 300, nullable: true })
  notes?: string | null;

  @Column({ type: 'date', nullable: true })
  nextDueDate?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
