import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TripsService } from './trips.service';
import { EstimateTripDto } from './dto/estimate-trip.dto';
import { CreateTripDto } from './dto/create-trip.dto';

@Controller('trips')
@UseGuards(AuthGuard('jwt'))
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post('estimate')
  estimate(@Body() dto: EstimateTripDto) {
    return this.tripsService.estimateAllCategories(dto);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateTripDto) {
    return this.tripsService.create(req.user.userId, dto);
  }

  @Get('me')
  findMine(@Req() req: any) {
    return this.tripsService.findAllForPassenger(req.user.userId);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.tripsService.findOwnedOrFail(id, req.user.userId);
  }

  @Patch(':id/assign-driver')
  assignDriver(
    @Req() req: any,
    @Param('id') id: string,
    @Body('preferDriverId') preferDriverId?: string,
    @Body('preferPhones') preferPhones?: string[],
    @Body('preferFemale') preferFemale?: boolean,
  ) {
    return this.tripsService.assignDriver(id, req.user.userId, preferDriverId, preferPhones, preferFemale);
  }

  @Patch(':id/start')
  start(@Req() req: any, @Param('id') id: string) {
    return this.tripsService.start(id, req.user.userId);
  }

  @Patch(':id/complete')
  complete(@Req() req: any, @Param('id') id: string, @Body('actualDistanceKm') actualDistanceKm?: number) {
    return this.tripsService.complete(id, req.user.userId, actualDistanceKm);
  }

  @Patch(':id/cancel')
  cancel(@Req() req: any, @Param('id') id: string, @Body('reason') reason?: string) {
    return this.tripsService.cancel(id, req.user.userId, reason);
  }
}

