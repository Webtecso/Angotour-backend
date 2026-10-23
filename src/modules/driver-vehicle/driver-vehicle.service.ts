import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { SaveVehicleDto } from './dto/save-vehicle.dto';

@Injectable()
export class DriverVehicleService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly repo: Repository<Vehicle>,
  ) {}

  private view(v: Vehicle) {
    return {
      id: v.id,
      model: v.model,
      plate: v.plate,
      color: v.color,
      categoryId: v.categoryId,
      capacity: v.capacity,
      status: v.status,
      rejectionReason: v.rejectionReason ?? null,
    };
  }

  async mine(driverId: string) {
    const v = await this.repo.findOne({ where: { driver: { id: driverId } } });
    return { vehicle: v ? this.view(v) : null };
  }

  /** Cria ou atualiza o veiculo do motorista. Qualquer alteracao volta a pedir revisao. */
  async save(driverId: string, dto: SaveVehicleDto) {
    const plate = dto.plate.trim().toUpperCase().replace(/\s+/g, ' ');
    if (!/^[A-Z0-9][A-Z0-9 -]{3,18}$/.test(plate)) {
      throw new BadRequestException('Matricula invalida.');
    }

    const clash = await this.repo.findOne({ where: { plate }, relations: ['driver'] });
    if (clash && clash.driver?.id !== driverId) {
      throw new ConflictException('Esta matricula ja esta registada noutra conta.');
    }

    let v = await this.repo.findOne({ where: { driver: { id: driverId } } });
    if (!v) v = this.repo.create({ driver: { id: driverId } as any });

    Object.assign(v, {
      model: dto.model.trim(),
      plate,
      color: dto.color.trim(),
      categoryId: dto.categoryId,
      capacity: dto.capacity,
      status: 'pending',
      rejectionReason: null,
      reviewedAt: null,
    });

    try {
      return { vehicle: this.view(await this.repo.save(v)) };
    } catch (e: any) {
      if (e?.code === '23505') throw new ConflictException('Esta matricula ja esta registada noutra conta.');
      throw e;
    }
  }
}
