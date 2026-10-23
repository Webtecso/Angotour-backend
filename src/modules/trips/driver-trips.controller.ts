import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TripsService } from './trips.service';

/** Rotas do motorista. O id do motorista vem sempre do token, nunca do cliente. */
@Controller('driver/trips')
@UseGuards(AuthGuard('driver-jwt'))
export class DriverTripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get('active')
  active(@Req() req: any) {
    return this.tripsService.driverActiveTrip(req.user.driverId);
  }

  @Patch(':id/accept')
  accept(@Req() req: any, @Param('id') id: string) {
    return this.tripsService.driverAccept(id, req.user.driverId);
  }

  @Patch(':id/decline')
  decline(@Req() req: any, @Param('id') id: string) {
    return this.tripsService.driverDecline(id, req.user.driverId);
  }

  @Post(':id/confirm-boarding')
  confirmBoarding(@Req() req: any, @Param('id') id: string, @Body('code') code: string) {
    return this.tripsService.driverConfirmBoarding(id, req.user.driverId, code);
  }

  @Patch(':id/start')
  start(@Req() req: any, @Param('id') id: string) {
    return this.tripsService.driverStart(id, req.user.driverId);
  }

  @Patch(':id/complete')
  complete(@Req() req: any, @Param('id') id: string) {
    return this.tripsService.driverComplete(id, req.user.driverId);
  }
}
