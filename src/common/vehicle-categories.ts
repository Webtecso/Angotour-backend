import { VehicleCategoryId } from '../modules/vehicles/entities/vehicle.entity';

/**
 * Tabela de precos por categoria - espelha o mockData.ts do app mobile.
 * preco = tarifaBase + km * precoPorKm + minutos * precoPorMin
 * com piso na tarifa minima, arredondado aos 50 Kz. Sem surge, nunca.
 */
export interface CategoryPricing {
  id: VehicleCategoryId;
  name: string;
  tarifaBaseKz: number;
  precoPorKmKz: number;
  precoPorMinKz: number;
  tarifaMinimaKz: number;
  velocidadeMediaKmh: number;
  etaMinutes: number;
  capacity: number;
  /** compatibilidade com codigo antigo que usava basePricePerKm */
  basePricePerKm: number;
}

function cat(
  id: VehicleCategoryId, name: string, base: number, perKm: number, perMin: number,
  min: number, speed: number, eta: number, capacity: number,
): CategoryPricing {
  return {
    id, name, tarifaBaseKz: base, precoPorKmKz: perKm, precoPorMinKz: perMin,
    tarifaMinimaKz: min, velocidadeMediaKmh: speed, etaMinutes: eta, capacity, basePricePerKm: perKm,
  };
}

export const CATEGORY_PRICING: Record<VehicleCategoryId, CategoryPricing> = {
  [VehicleCategoryId.ANGO_TAXI]: cat(VehicleCategoryId.ANGO_TAXI, 'AngoTaxi', 500, 180, 15, 800, 22, 3, 4),
  [VehicleCategoryId.ANGO_CONFORTO]: cat(VehicleCategoryId.ANGO_CONFORTO, 'Conforto', 700, 230, 20, 1100, 22, 4, 4),
  [VehicleCategoryId.ANGO_EXECUTIVO]: cat(VehicleCategoryId.ANGO_EXECUTIVO, 'Executivo', 1000, 320, 28, 1600, 24, 6, 4),
  [VehicleCategoryId.ANGO_FAMILY]: cat(VehicleCategoryId.ANGO_FAMILY, 'Familia', 800, 260, 22, 1300, 20, 5, 6),
  [VehicleCategoryId.ANGO_GRUPO]: cat(VehicleCategoryId.ANGO_GRUPO, 'Grupo', 1200, 380, 32, 2000, 20, 7, 8),
  [VehicleCategoryId.ANGO_AEROPORTO]: cat(VehicleCategoryId.ANGO_AEROPORTO, 'Aeroporto', 900, 240, 20, 1500, 26, 4, 4),
  [VehicleCategoryId.ANGO_TOUR]: cat(VehicleCategoryId.ANGO_TOUR, 'Turismo', 1000, 300, 25, 1700, 20, 8, 4),
  [VehicleCategoryId.ANGO_MOTO]: cat(VehicleCategoryId.ANGO_MOTO, 'Moto', 250, 100, 8, 400, 28, 3, 1),
  [VehicleCategoryId.ANGO_ACESSIVEL]: cat(VehicleCategoryId.ANGO_ACESSIVEL, 'Acessivel', 700, 220, 18, 1100, 20, 8, 4),
};

export interface PriceBreakdown {
  tarifaBaseKz: number;
  distanceKm: number;
  distanceCostKz: number;
  durationMinutes: number;
  durationCostKz: number;
  subtotalKz: number;
  tarifaMinimaKz: number;
  tarifaMinimaAplicada: boolean;
  finalPriceKz: number;
}

export function calculatePriceBreakdown(distanceKm: number, categoryId: VehicleCategoryId): PriceBreakdown {
  const c = CATEGORY_PRICING[categoryId];
  const durationMinutes = Math.round((distanceKm / c.velocidadeMediaKmh) * 60);
  const distanceCostKz = Math.round(distanceKm * c.precoPorKmKz);
  const durationCostKz = Math.round(durationMinutes * c.precoPorMinKz);
  const subtotalKz = c.tarifaBaseKz + distanceCostKz + durationCostKz;
  const tarifaMinimaAplicada = subtotalKz < c.tarifaMinimaKz;
  const beforeRounding = tarifaMinimaAplicada ? c.tarifaMinimaKz : subtotalKz;
  const finalPriceKz = Math.round(beforeRounding / 50) * 50;
  return {
    tarifaBaseKz: c.tarifaBaseKz, distanceKm, distanceCostKz, durationMinutes, durationCostKz,
    subtotalKz, tarifaMinimaKz: c.tarifaMinimaKz, tarifaMinimaAplicada, finalPriceKz,
  };
}

export function calculateTripPrice(distanceKm: number, categoryId: VehicleCategoryId): number {
  return calculatePriceBreakdown(distanceKm, categoryId).finalPriceKz;
}

/** Usado pelo painel admin: altera uma categoria em memoria (os calculos de preco leem esta mesma referencia). */
export function setCategoryPricing(id: VehicleCategoryId, patch: Partial<Pick<CategoryPricing, 'tarifaBaseKz' | 'precoPorKmKz' | 'precoPorMinKz' | 'tarifaMinimaKz' | 'velocidadeMediaKmh'>>): void {
  const c = CATEGORY_PRICING[id];
  if (!c) return;
  if (patch.tarifaBaseKz !== undefined) c.tarifaBaseKz = patch.tarifaBaseKz;
  if (patch.precoPorKmKz !== undefined) { c.precoPorKmKz = patch.precoPorKmKz; c.basePricePerKm = patch.precoPorKmKz; }
  if (patch.precoPorMinKz !== undefined) c.precoPorMinKz = patch.precoPorMinKz;
  if (patch.tarifaMinimaKz !== undefined) c.tarifaMinimaKz = patch.tarifaMinimaKz;
  if (patch.velocidadeMediaKmh !== undefined) c.velocidadeMediaKmh = patch.velocidadeMediaKmh;
}
