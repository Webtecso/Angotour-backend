import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('agents')
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  fullName: string;

  @Index({ unique: true })
  @Column({ length: 20 })
  phone: string;

  @Column({ nullable: true, length: 120 })
  email?: string;

  @Index({ unique: true })
  @Column({ length: 12 })
  referralCode: string;

  // Percentagem DA COMISSAO DA PLATAFORMA (nao do valor da corrida) que o agente recebe pelos motoristas que recrutou.
  @Column({ type: 'float', default: 10 })
  commissionPercent: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string; // active | inactive

  @CreateDateColumn()
  createdAt: Date;
}
