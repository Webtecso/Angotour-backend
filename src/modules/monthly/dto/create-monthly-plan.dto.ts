import { MonthlyModality } from '../entities/monthly-plan.entity';

export class CreateMonthlyPlanDto {
  name: string;
  modality: MonthlyModality;
  weeklyFrequency?: number;
  tripsPerDay?: number;
  includedKm: number;
  includedWaitMinutes?: number;
  minCapacity?: number;
  maxCapacity?: number;
  priceKz: number;
  conditions?: string;
}
