import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ratings')
@Index(['userId', 'tripRef'], { unique: true })
export class Rating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 60 })
  tripRef: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  driverId?: string;

  @Column({ type: 'int' })
  stars: number;

  @Column({ type: 'text', default: '' })
  comment: string;

  @CreateDateColumn()
  createdAt: Date;
}
