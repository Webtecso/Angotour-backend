import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Documentos de identidade do passageiro: BI (frente/verso) e selfie. Nunca se auto-aprova. */
export const REQUIRED_IDENTITY_DOCUMENTS = ['bi_front', 'bi_back', 'selfie'] as const;
export type IdentityDocumentType = (typeof REQUIRED_IDENTITY_DOCUMENTS)[number];
export type IdentityDocumentStatus = 'pending' | 'approved' | 'rejected';

@Entity('user_documents')
@Index(['userId', 'type'], { unique: true })
export class UserDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 30 })
  type: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: IdentityDocumentStatus;

  // Caminho no disco do servidor - nunca e devolvido ao cliente.
  @Column({ type: 'varchar', length: 400 })
  filePath: string;

  @Column({ type: 'varchar', length: 20 })
  mimeType: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
