import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 20 })
  caseNumber: string;

  @Index()
  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 20, default: 'incident' })
  kind: string; // 'incident' | 'lost_item'

  @Column({ length: 80 })
  category: string;

  @Column({ type: 'text', default: '' })
  description: string;

  // Referencia livre a viagem (id remoto ou local); nao e FK porque o historico mock ainda usa ids locais.
  @Column({ type: 'varchar', length: 60, nullable: true })
  tripRef?: string;

  // recebido -> analise_automatica -> em_investigacao -> decisao -> resolvido
  @Column({ type: 'varchar', length: 30, default: 'recebido' })
  status: string;

  // normal | elevado | critico (SOS gera sempre 'critico')
  @Column({ type: 'varchar', length: 10, default: 'normal' })
  severity: string;

  @Column({ default: false })
  isLiveShare: boolean;

  // Quem reportou: passenger (omissao) | driver. Para driver, userId guarda o id do motorista.
  @Column({ type: 'varchar', length: 10, default: 'passenger' })
  reporterType: string;

  @Column({ type: 'float', nullable: true })
  liveLocationLat?: number;

  @Column({ type: 'float', nullable: true })
  liveLocationLng?: number;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;
}

