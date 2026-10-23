import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Registo de acoes administrativas. So se acrescenta, nunca se edita. */
@Entity('admin_audit_logs')
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  adminId?: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  adminEmail?: string | null;

  @Column({ type: 'varchar', length: 60 })
  action: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  targetType?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  targetId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
