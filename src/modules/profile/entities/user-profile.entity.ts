import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('user_profiles')
export class UserProfile {
  @PrimaryColumn('uuid')
  userId: string;

  @Column({ default: false })
  isVerified: boolean;

  // none | pending | verified | rejected - a verificacao de identidade nunca
  // se auto-aprova; fica pendente ate um revisor confirmar (Admin/Document Center).
  @Column({ type: 'varchar', length: 20, default: 'none' })
  verificationStatus: string;

  @Column({ type: 'int', default: 0 })
  angoPoints: number;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt?: Date;
}

