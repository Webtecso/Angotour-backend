import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('owners')
export class Owner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  fullName: string;

  @Index({ unique: true })
  @Column({ length: 20 })
  phone: string;

  @Column({ nullable: true, length: 120 })
  email?: string;

  @CreateDateColumn()
  createdAt: Date;
}
