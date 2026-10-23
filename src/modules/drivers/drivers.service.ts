import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver, DriverStatus } from './entities/driver.entity';
import { Coordinates, toGeoPoint } from '../../common/geo.util';

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver)
    private readonly driversRepository: Repository<Driver>,
  ) {}

  findByPhone(phone: string): Promise<Driver | null> {
    return this.driversRepository.findOne({ where: { phone } });
  }

  create(dto: { phone: string; fullName: string }): Promise<Driver> {
    const driver = this.driversRepository.create({ phone: dto.phone, fullName: dto.fullName });
    return this.driversRepository.save(driver);
  }

  async updateLocation(driverId: string, coords: Coordinates): Promise<void> {
    await this.driversRepository.update(driverId, { currentLocation: toGeoPoint(coords) });
  }

  async setStatus(driverId: string, status: DriverStatus): Promise<Driver> {
    const driver = await this.driversRepository.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Motorista nao encontrado.');
    driver.status = status;
    return this.driversRepository.save(driver);
  }

  /**
   * Encontra motoristas online dentro de um raio (em km), ordenados por
   * distancia. Usa PostGIS ST_DWithin (indexavel, rapido) + ST_Distance.
   *
   * Requer indice espacial para bom desempenho em producao:
   *   CREATE INDEX idx_drivers_location ON drivers USING GIST (current_location);
   */
  async findNearby(coords: Coordinates, radiusKm = 5): Promise<Array<Driver & { distanceKm: number }>> {
    const radiusMeters = radiusKm * 1000;

    const rows = await this.driversRepository
      .createQueryBuilder('driver')
      .addSelect(
        `ST_Distance(driver.currentLocation, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) / 1000`,
        'distanceKm',
      )
      .where('driver.status = :status', { status: DriverStatus.ONLINE })
      .andWhere(
        `ST_DWithin(driver.currentLocation, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radiusMeters)`,
      )
      .setParameters({ lat: coords.latitude, lng: coords.longitude, radiusMeters })
      .orderBy('"distanceKm"', 'ASC')
      .getRawAndEntities();

    return rows.entities.map((driver, index) => ({
      ...driver,
      distanceKm: Number(rows.raw[index].distanceKm),
    }));
  }
}
