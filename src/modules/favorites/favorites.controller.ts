import { Body, Controller, Delete, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FavoritesService } from './favorites.service';
import { UpsertFavoriteDto } from './dto/upsert-favorite.dto';

@Controller('favorites')
@UseGuards(AuthGuard('jwt'))
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}

  @Get()
  list(@Req() req: any) {
    return this.service.list(req.user.userId);
  }

  @Put()
  upsert(@Req() req: any, @Body() dto: UpsertFavoriteDto) {
    return this.service.upsert(req.user.userId, dto);
  }

  @Delete(':placeKey')
  remove(@Req() req: any, @Param('placeKey') placeKey: string) {
    return this.service.remove(req.user.userId, placeKey);
  }
}
