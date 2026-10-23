import { Body, Controller, Delete, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DriverFeedbackService } from './driver-feedback.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { SetFavoriteDriverDto } from './dto/set-favorite-driver.dto';

@UseGuards(AuthGuard('jwt'))
@Controller()
export class DriverFeedbackController {
  constructor(private readonly service: DriverFeedbackService) {}

  @Post('ratings')
  rate(@Req() req: any, @Body() dto: CreateRatingDto) {
    return this.service.rate(req.user.userId, dto);
  }

  @Get('favorite-driver')
  async getFavorite(@Req() req: any) {
    return (await this.service.getFavorite(req.user.userId)) ?? { driverId: null, driverName: null };
  }

  @Put('favorite-driver')
  setFavorite(@Req() req: any, @Body() dto: SetFavoriteDriverDto) {
    return this.service.setFavorite(req.user.userId, dto);
  }

  @Delete('favorite-driver')
  clearFavorite(@Req() req: any) {
    return this.service.clearFavorite(req.user.userId);
  }
}
