import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('favorite_places')
@Index(['userId', 'placeKey'], { unique: true })
export class FavoritePlace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  // id do lugar na app (ex: fav-home, fav-work, fav-custom-123)
  @Column({ type: 'varchar', length: 60 })
  placeKey: string;

  @Column({ type: 'varchar', length: 80 })
  label: string;

  @Column({ type: 'varchar', length: 20, default: 'favorite' })
  kind: string;

  @Column({ type: 'varchar', length: 200 })
  address: string;

  @Column({ type: 'float' })
  latitude: number;

  @Column({ type: 'float' })
  longitude: number;

  @CreateDateColumn()
  createdAt: Date;
}
