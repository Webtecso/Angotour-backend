import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';

const LABELS: Record<string, string> = {
  tiresOk: 'pneus', brakesOk: 'travoes', lightsOk: 'luzes', acOk: 'ar condicionado', documentationOk: 'documentacao',
};

/**
 * Certificacao de veiculos para ficar online.
 * - ultima inspecao reprovada: bloqueia sempre
 * - inspecao expirada: so bloqueia com CERT_BLOCK_EXPIRED=true (por defeito, aviso no log)
 * - nunca inspecionado: so bloqueia com CERT_REQUIRE_INSPECTION=true
 */
export async function assertVehicleCertified(db: DataSource, driverId: string): Promise<void> {
  const vehicles: Array<{ id: string; plate: string }> = await db.query(
    `SELECT id, plate FROM vehicles WHERE "driverId" = $1 AND status = 'approved'`,
    [driverId],
  );
  for (const v of vehicles) {
    const rows = await db.query(
      `SELECT status, "nextDueDate"::text AS "nextDueDate", "tiresOk", "brakesOk", "lightsOk", "acOk", "documentationOk"
       FROM vehicle_inspections WHERE "vehicleId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      [v.id],
    );
    const last = rows[0];
    if (!last) {
      if (process.env.CERT_REQUIRE_INSPECTION === 'true') {
        throw new ForbiddenException(`O veiculo ${v.plate} ainda nao foi inspecionado. Agenda a inspecao AngoTour.`);
      }
      continue;
    }
    if (last.status === 'failed') {
      const failed = Object.keys(LABELS).filter((k) => last[k] === false).map((k) => LABELS[k]);
      throw new ForbiddenException(
        `O veiculo ${v.plate} reprovou na inspecao${failed.length ? ' (' + failed.join(', ') + ')' : ''}. Resolve e pede nova inspecao para receber corridas.`,
      );
    }
    const today = new Date(Date.now() + 3600000).toISOString().slice(0, 10);
    if (last.nextDueDate && String(last.nextDueDate).slice(0, 10) < today) {
      if (process.env.CERT_BLOCK_EXPIRED === 'true') {
        throw new ForbiddenException(`A inspecao do veiculo ${v.plate} expirou. Pede nova inspecao para receber corridas.`);
      }
      console.warn(`[Certificacao] inspecao expirada: ${v.plate} (motorista ${driverId})`);
    }
  }
}
