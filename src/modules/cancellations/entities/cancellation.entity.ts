import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cancellations')
export class Cancellation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  tripRef?: string;

  @Column({ type: 'varchar', length: 200 })
  reason: string;

  // legitimo | a_monitorizar | suspeito
  @Column({ type: 'varchar', length: 20 })
  risk: string;

  @CreateDateColumn()
  createdAt: Date;
}
