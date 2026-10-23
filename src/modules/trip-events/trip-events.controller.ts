import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TripEventsService } from './trip-events.service';
import { CreateTripEventDto } from './dto/create-trip-event.dto';

@Controller('trip-events')
@UseGuards(AuthGuard('jwt'))
export class TripEventsController {
  constructor(private readonly service: TripEventsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateTripEventDto) {
    return this.service.create(req.user.userId, dto);
  }

  @Get('trip/:tripRef')
  findByTrip(@Req() req: any, @Param('tripRef') tripRef: string) {
    return this.service.findByTrip(req.user.userId, tripRef);
  }
}
