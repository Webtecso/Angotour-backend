import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Tarifa editada pelo admin para uma categoria. Sem linha = vale a tarifa por omissao do codigo. */
@Entity('pricing_rules')
export class PricingRule {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  categoryId: string;

  @Column({ type: 'int' })
  tarifaBaseKz: number;

  @Column({ type: 'int' })
  precoPorKmKz: number;

  @Column({ type: 'int' })
  precoPorMinKz: number;

  @Column({ type: 'int' })
  tarifaMinimaKz: number;

  @Column({ type: 'int' })
  velocidadeMediaKmh: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
