import { Column, Entity, PrimaryColumn } from 'typeorm';

// driverId e varchar porque a app ainda pode usar ids de motoristas demo (ex: drv-1).
@Entity('favorite_drivers')
export class FavoriteDriver {
  @PrimaryColumn('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 60 })
  driverId: string;

  @Column({ type: 'varchar', length: 120 })
  driverName: string;
}
