import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('wallet_topups')
export class WalletTopUp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @Column({ type: 'int' })
  amountKz: number;

  @Column({ length: 20 })
  reference: string;

  // processing | confirmed | failed
  @Column({ type: 'varchar', length: 20, default: 'processing' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
