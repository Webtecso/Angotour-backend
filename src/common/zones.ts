import { haversineDistanceKm } from './geo.util';

export interface Zone {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  /** Incentivo pago ao motorista (Kz) quando o destino cai nesta zona. 0 para zonas centrais. */
  incentiveKz: number;
}

/** Zonas perifericas de Luanda com incentivo. Valores de referencia - ajustar com dados reais de procura/custo. */
export const ZONES: Zone[] = [
  { id: 'talatona', name: 'Talatona', centerLat: -8.9167, centerLng: 13.1833, radiusKm: 5, incentiveKz: 0 },
  { id: 'viana', name: 'Viana', centerLat: -8.9034, centerLng: 13.3756, radiusKm: 6, incentiveKz: 300 },
  { id: 'zango', name: 'Zango', centerLat: -8.9700, centerLng: 13.4200, radiusKm: 6, incentiveKz: 500 },
  { id: 'cacuaco', name: 'Cacuaco', centerLat: -8.7833, centerLng: 13.3667, radiusKm: 6, incentiveKz: 600 },
];

const DEFAULT_ZONE: Zone = { id: 'luanda', name: 'Luanda', centerLat: -8.8399, centerLng: 13.2894, radiusKm: 0, incentiveKz: 0 };

/** Zona mais proxima de um ponto, entre as que o contem (ou "Luanda" por omissao). */
export function findZone(lat: number, lng: number): Zone {
  const point = { latitude: lat, longitude: lng };
  const inside = ZONES.filter((z) => haversineDistanceKm(point, { latitude: z.centerLat, longitude: z.centerLng }) <= z.radiusKm);
  if (inside.length === 0) return DEFAULT_ZONE;
  return inside.sort(
    (a, b) =>
      haversineDistanceKm(point, { latitude: a.centerLat, longitude: a.centerLng }) -
      haversineDistanceKm(point, { latitude: b.centerLat, longitude: b.centerLng }),
  )[0];
}

export function zoneIncentiveForPoint(lat: number, lng: number): number {
  return findZone(lat, lng).incentiveKz;
}
