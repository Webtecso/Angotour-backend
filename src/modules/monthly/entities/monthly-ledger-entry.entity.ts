import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Livro-razao do AngoTour Mensal. So se acrescenta, nunca se edita o valor.
 * revenue (receita bruta) | commission (AngoTour) | driver_payable (devido ao motorista) | refund
 * O indice unico torna a gravacao idempotente.
 */
@Entity('monthly_ledger_entries')
@Index(['contractId', 'period', 'kind'], { unique: true })
export class MonthlyLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  contractId: string;

  // AAAA-MM do inicio do periodo (permite renovacoes do mesmo contrato).
  @Column({ type: 'varchar', length: 7 })
  period: string;

  @Column({ type: 'varchar', length: 20 })
  kind: string;

  @Column({ type: 'int' })
  amountKz: number;

  // settled | pending (devido, ainda nao pago) | paid | reversed
  @Column({ type: 'varchar', length: 20, default: 'settled' })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  meta?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
