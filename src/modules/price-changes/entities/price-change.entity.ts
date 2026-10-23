import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Registo (Evidence Vault) de propostas de alteracao de preco. Nao altera o
 * priceKz da viagem: o preco protegido so muda por uma decisao explicita.
 */
@Entity('price_changes')
export class PriceChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @Index()
  @Column({ type: 'varchar', length: 60 })
  tripRef: string;

  @Column({ type: 'int' })
  originalPriceKz: number;

  @Column({ type: 'int' })
  proposedPriceKz: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  reason?: string;

  // proposta | aceite | reportada
  @Column({ type: 'varchar', length: 20, default: 'proposta' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt?: Date;
}
