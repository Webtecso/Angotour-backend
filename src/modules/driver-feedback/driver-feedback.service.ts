import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from './entities/rating.entity';
import { FavoriteDriver } from './entities/favorite-driver.entity';
import { CreateRatingDto } from './dto/create-rating.dto';
import { SetFavoriteDriverDto } from './dto/set-favorite-driver.dto';

@Injectable()
export class DriverFeedbackService {
  constructor(
    @InjectRepository(Rating) private readonly ratings: Repository<Rating>,
    @InjectRepository(FavoriteDriver) private readonly favorites: Repository<FavoriteDriver>,
  ) {}

  /** Uma avaliacao por viagem: reenviar atualiza a anterior. */
  async rate(userId: string, dto: CreateRatingDto): Promise<Rating> {
    const existing = await this.ratings.findOne({ where: { userId, tripRef: dto.tripRef } });
    if (existing) {
      existing.stars = dto.stars;
      existing.comment = dto.comment ?? existing.comment;
      existing.driverId = dto.driverId ?? existing.driverId;
      return this.ratings.save(existing);
    }
    return this.ratings.save(this.ratings.create({ ...dto, comment: dto.comment ?? '', userId }));
  }

  async getFavorite(userId: string): Promise<FavoriteDriver | null> {
    return this.favorites.findOne({ where: { userId } });
  }

  setFavorite(userId: string, dto: SetFavoriteDriverDto): Promise<FavoriteDriver> {
    return this.favorites.save(this.favorites.create({ userId, ...dto }));
  }

  async clearFavorite(userId: string): Promise<{ ok: true }> {
    await this.favorites.delete({ userId });
    return { ok: true };
  }
}
