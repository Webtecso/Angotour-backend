import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { MonthlyModality } from './monthly-plan.entity';

@Entity('monthly_contracts')
export class MonthlyContract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  requestId: string;

  @Index()
  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  modality: MonthlyModality;

  @Column({ type: 'uuid', nullable: true })
  planId?: string;

  @Column({ type: 'uuid', nullable: true })
  driverId?: string;

  @Column({ type: 'uuid', nullable: true })
  vehicleId?: string;

  @Column({ type: 'float' })
  priceKz: number;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date', nullable: true })
  endDate?: string;

  // rascunho -> proposta_emitida -> aguardando_pagamento -> pago -> aguardando_atribuicao -> ativo -> suspenso -> em_renovacao -> concluido -> cancelado -> reembolsado
  @Column({ type: 'varchar', length: 30, default: 'rascunho' })
  status: string;

  @Column({ default: false })
  conditionsAccepted: boolean;

  // Validade da proposta: depois disto nao pode ser aceite.
  @Column({ type: 'timestamptz', nullable: true })
  proposalExpiresAt?: Date | null;

  // Referencia de pagamento emitida na aceitacao.
  @Column({ type: 'varchar', length: 20, nullable: true })
  paymentReference?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date | null;

﻿  // Renovacao: contrato de que este e a continuacao.
  @Column({ type: 'uuid', nullable: true })
  renewedFromId?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt?: Date | null;

  @Column({ type: 'int', nullable: true })
  refundKz?: number | null;

  // Composicao do preco guardada para auditoria (plano, preco base, preco final, quem emitiu).
  @Column({ type: 'jsonb', nullable: true })
  priceBreakdown?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
