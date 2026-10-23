import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Historico de alteracoes de comissao e tarifas. So se acrescenta, nunca se edita. */
@Entity('settings_history')
export class SettingsHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  kind: string;

  @Column({ type: 'varchar', length: 60 })
  target: string;

  @Column({ type: 'jsonb', nullable: true })
  oldValue?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  newValue?: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  adminId?: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  adminEmail?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
