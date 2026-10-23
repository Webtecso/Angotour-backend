import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type DriverWalletKind = 'topup' | 'commission';
export type DriverWalletStatus = 'processing' | 'confirmed' | 'failed' | 'reserved' | 'settled' | 'released';

/**
 * Livro-razao da carteira do motorista.
 * topup:      processing -> confirmed | failed
 * commission: reserved (ao aceitar) -> settled (ao concluir) | released (cancelada)
 * O indice unico impede reservar/liquidar a mesma comissao duas vezes.
 */
@Entity('driver_wallet_entries')
@Index(['driverId', 'tripId', 'kind'], { unique: true })
export class DriverWalletEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  driverId: string;

  @Column({ type: 'varchar', length: 20 })
  kind: DriverWalletKind;

  @Column({ type: 'int' })
  amountKz: number;

  @Column({ type: 'varchar', length: 20 })
  status: DriverWalletStatus;

  @Column({ type: 'uuid', nullable: true })
  tripId?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  reference?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  settledAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
