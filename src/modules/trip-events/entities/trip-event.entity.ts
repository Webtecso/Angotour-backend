import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Evidence Vault: timeline de eventos por viagem. A hora "oficial" e a do
 * servidor (createdAt); clientAt guarda a hora do telemovel, util quando o
 * evento foi gerado offline e enviado mais tarde.
 */
@Entity('trip_events')
export class TripEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @Index()
  @Column({ type: 'varchar', length: 60 })
  tripRef: string;

  @Column({ type: 'varchar', length: 40 })
  type: string;

  @Column({ type: 'jsonb', nullable: true })
  meta?: Record<string, string | number>;

  @Column({ type: 'timestamptz', nullable: true })
  clientAt?: Date;

  @CreateDateColumn()
  createdAt: Date;
}
