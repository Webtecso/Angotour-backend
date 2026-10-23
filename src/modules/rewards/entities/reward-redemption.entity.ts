import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('reward_redemptions')
export class RewardRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  rewardId: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'int' })
  costPoints: number;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @CreateDateColumn()
  createdAt: Date;
}
