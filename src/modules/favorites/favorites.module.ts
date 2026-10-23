import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoritePlace } from './entities/favorite-place.entity';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FavoritePlace])],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
