import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FavoritePlace } from './entities/favorite-place.entity';
import { UpsertFavoriteDto } from './dto/upsert-favorite.dto';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(FavoritePlace)
    private readonly repo: Repository<FavoritePlace>,
  ) {}

  list(userId: string): Promise<FavoritePlace[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'ASC' } });
  }

  async upsert(userId: string, dto: UpsertFavoriteDto): Promise<FavoritePlace[]> {
    const existing = await this.repo.findOne({ where: { userId, placeKey: dto.placeKey } });
    if (existing) {
      Object.assign(existing, {
        label: dto.label,
        kind: dto.kind ?? existing.kind,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
      });
      await this.repo.save(existing);
    } else {
      await this.repo.save(this.repo.create({ ...dto, kind: dto.kind ?? 'favorite', userId }));
    }
    return this.list(userId);
  }

  async remove(userId: string, placeKey: string): Promise<FavoritePlace[]> {
    await this.repo.delete({ userId, placeKey });
    return this.list(userId);
  }
}
