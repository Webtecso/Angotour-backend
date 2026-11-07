import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type MonthlyModality = 'shared' | 'individual';

@Entity('monthly_plans')
export class MonthlyPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  modality: MonthlyModality;

  @Column({ type: 'int', default: 5 })
  weeklyFrequency: number;

  @Column({ type: 'int', default: 2 })
  tripsPerDay: number;

  @Column({ type: 'float', default: 0 })
  includedKm: number;

  @Column({ type: 'int', default: 0 })
  includedWaitMinutes: number;

  @Column({ type: 'int', nullable: true })
  minCapacity?: number;

  @Column({ type: 'int', nullable: true })
  maxCapacity?: number;

  @Column({ type: 'float' })
  priceKz: number;

  @Column({ type: 'text', default: '' })
  conditions: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
