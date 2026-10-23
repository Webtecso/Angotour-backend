// Comissao da plataforma (fracao da corrida). Valor por omissao: 12% (documento de produto).
// O PricingService substitui-o pelo valor guardado na base de dados ao arrancar.
let commissionRate = 0.12;

export function getCommissionRate(): number {
  return commissionRate;
}

export function setCommissionRate(rate: number): void {
  commissionRate = rate;
}
