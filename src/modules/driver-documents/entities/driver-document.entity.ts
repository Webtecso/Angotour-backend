import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Documentos obrigatorios para o motorista poder operar (secoes 4, 5 e 60 do documento de produto). */
export const REQUIRED_DRIVER_DOCUMENTS = [
  'bi_front',
  'bi_back',
  'selfie',
  'license',
  'vehicle_registration',
  'insurance',
] as const;

export type DriverDocumentType = (typeof REQUIRED_DRIVER_DOCUMENTS)[number];
export type DriverDocumentStatus = 'pending' | 'approved' | 'rejected';

/** Um registo por motorista e tipo: reenviar substitui o ficheiro e volta a "pending". */
@Entity('driver_documents')
@Index(['driverId', 'type'], { unique: true })
export class DriverDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  driverId: string;

  @Column({ type: 'varchar', length: 30 })
  type: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: DriverDocumentStatus;

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
