import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Um servico diario de um contrato mensal (ida ou volta). */
@Entity('monthly_executions')
@Index(['contractId', 'date', 'direction'], { unique: true })
export class MonthlyExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  contractId: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  driverId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  vehicleId?: string | null;

  @Column({ type: 'date' })
  date: string;

  // ida | volta
  @Column({ type: 'varchar', length: 10 })
  direction: string;

  // HH:MM
  @Column({ type: 'varchar', length: 5 })
  scheduledTime: string;

  // agendada -> em_curso -> concluida | cancelada
  @Column({ type: 'varchar', length: 20, default: 'agendada' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
