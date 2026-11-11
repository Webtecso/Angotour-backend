import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DriverProfileService } from './driver-profile.service';

/** O id do motorista vem sempre do token (driver-jwt). */
@Controller('driver/profile')
@UseGuards(AuthGuard('driver-jwt'))
export class DriverProfileController {
  constructor(private readonly profile: DriverProfileService) {}

  @Get()
  me(@Req() req: any) { return this.profile.me(req.user.driverId); }

  @Get('earnings')
  earnings(@Req() req: any) { return this.profile.earnings(req.user.driverId); }

  @Get('history')
  history(@Req() req: any) { return this.profile.history(req.user.driverId); }
}
