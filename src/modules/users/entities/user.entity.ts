import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Trip } from '../../trips/entities/trip.entity';

export enum PreferredLanguage {
  PT = 'pt',
  EN = 'en',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  fullName: string;

  @Column({ unique: true, length: 20 })
  phone: string;

  @Column({ nullable: true, length: 120 })
  email?: string;

  @Column({ type: 'date', nullable: true })
  birthDate?: string;

  @Column({ nullable: true })
  photoUrl?: string;

  @Column({ type: 'enum', enum: PreferredLanguage, default: PreferredLanguage.PT })
  preferredLanguage: PreferredLanguage;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: 0 })
  angoPoints: number;

  @OneToMany(() => Trip, (trip) => trip.passenger)
  trips: Trip[];

  @CreateDateColumn()
  createdAt: Date;
}
