import { getCommissionRate } from './platform-config';

export const COMMISSION_PLANS = ['economy', 'pro', 'subscription'] as const;
export type CommissionPlan = (typeof COMMISSION_PLANS)[number];

/** Taxa do plano Pro (placeholder comercial a validar). Nunca excede a taxa base. */
export const PRO_RATE = 0.08;

export function commissionRateFor(plan?: string | null): number {
  if (plan === 'subscription') return 0; // mensalidade ainda nao cobrada: so isenta a comissao por corrida
  if (plan === 'pro') return Math.min(PRO_RATE, getCommissionRate());
  return getCommissionRate();
}

export function commissionKzFor(priceKz: number, plan?: string | null): number {
  return Math.round((priceKz * commissionRateFor(plan)) / 50) * 50;
}
