import { ForbiddenException } from '@nestjs/common';

/** Qualquer coisa com .query (DataSource ou EntityManager). */
export interface SqlRunner {
  query(sql: string, params?: any[]): Promise<any>;
}

/** O motorista tem um veiculo aprovado pelo admin? */
export async function vehicleApproved(db: SqlRunner, driverId: string): Promise<boolean> {
  const rows = await db.query(
    `SELECT 1 FROM vehicles WHERE "driverId" = $1 AND status = 'approved' LIMIT 1`,
    [driverId],
  );
  return Array.isArray(rows) && rows.length > 0;
}

export async function assertVehicleApproved(db: SqlRunner, driverId: string): Promise<void> {
  if (!(await vehicleApproved(db, driverId))) {
    throw new ForbiddenException(
      'Veiculo por aprovar. Regista o veiculo em Perfil > Meu veiculo e aguarda a aprovacao da equipa AngoTour.',
    );
  }
}
