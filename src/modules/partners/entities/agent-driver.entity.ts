import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Associacao agente -> motorista recrutado. Um motorista so pode ter um agente. */
@Entity('agent_drivers')
export class AgentDriver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  agentId: string;

  @Index({ unique: true })
  @Column('uuid')
  driverId: string;

  @CreateDateColumn()
  createdAt: Date;
}
