import { IsIn } from 'class-validator';
import { COMMISSION_PLANS } from '../../../common/commission-plans';

export class SetCommissionPlanDto {
  @IsIn([...COMMISSION_PLANS])
  plan: string;
}
