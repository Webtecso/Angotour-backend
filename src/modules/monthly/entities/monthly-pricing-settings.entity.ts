import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Parametros do motor de precos. Uma unica linha (id = 'default'). Valores por omissao sao placeholders a calibrar. */
@Entity('monthly_pricing_settings')
export class MonthlyPricingSettings {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  id: string;

  @Column({ type: 'float', default: 120 })
  fuelCostPerKmKz: number;

  @Column({ type: 'float', default: 25 })
  maintenancePerKmKz: number;

  @Column({ type: 'int', default: 1500 })
  driverPayPerTripKz: number;

  @Column({ type: 'int', default: 15000 })
  insuranceDocsMonthlyKz: number;

  @Column({ type: 'int', default: 0 })
  otherCostsMonthlyKz: number;

  @Column({ type: 'int', default: 2000 })
  availabilityPerHourKz: number;

  // Multiplica a distancia em linha reta para estimar a distancia por estrada.
  @Column({ type: 'float', default: 1.3 })
  roadFactor: number;

  @Column({ type: 'float', default: 15 })
  marginPercent: number;

  @Column({ type: 'float', default: 5 })
  riskReservePercent: number;

  @Column({ type: 'int', default: 0 })
  minPriceKz: number;

  // 0 = sem limite
  @Column({ type: 'int', default: 0 })
  maxPriceKz: number;

  // Se true, emitir proposta abaixo do minimo viavel exige autorizacao de subsidio.
  @Column({ default: false })
  enforceViability: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
