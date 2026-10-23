import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DriverVehicleService } from './driver-vehicle.service';
import { SaveVehicleDto } from './dto/save-vehicle.dto';

/** O id do motorista vem sempre do token (driver-jwt), nunca do cliente. */
@Controller('driver/vehicle')
@UseGuards(AuthGuard('driver-jwt'))
export class DriverVehicleController {
  constructor(private readonly vehicles: DriverVehicleService) {}

  @Get()
  mine(@Req() req: any) {
    return this.vehicles.mine(req.user.driverId);
  }

  // POST (e nao PUT) porque o helper da app do motorista so tem GET/POST/PATCH/DELETE.
  @Post()
  save(@Req() req: any, @Body() dto: SaveVehicleDto) {
    return this.vehicles.save(req.user.driverId, dto);
  }
}
