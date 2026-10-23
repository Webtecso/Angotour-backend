import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('platform_settings')
export class PlatformSetting {
  @PrimaryColumn({ type: 'varchar', length: 60 })
  key: string;

  @Column({ type: 'varchar', length: 200 })
  value: string;
}
