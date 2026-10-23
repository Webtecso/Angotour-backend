import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Driver } from '../../drivers/entities/driver.entity';
import { VehicleCategoryId } from '../../../common/vehicle-category.enum';

// Re-export: o resto do codigo continua a importar daqui.
export { VehicleCategoryId };

export type VehicleReviewStatus = 'pending' | 'approved' | 'rejected';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 60 })
  model: string;

  @Column({ length: 20, unique: true })
  plate: string;

  @Column({ length: 30 })
  color: string;

  @Column({ type: 'enum', enum: VehicleCategoryId, default: VehicleCategoryId.ANGO_TAXI })
  categoryId: VehicleCategoryId;

  @Column({ default: 4 })
  capacity: number;

  // Revisao pelo admin: o motorista envia, nunca se auto-aprova.
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: VehicleReviewStatus;

  @Column({ type: 'varchar', length: 300, nullable: true })
  rejectionReason?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;

  @OneToOne(() => Driver, (driver) => driver.vehicle)
  @JoinColumn()
  driver: Driver;

  @CreateDateColumn()
  createdAt: Date;
}
