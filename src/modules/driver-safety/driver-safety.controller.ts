import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SupportService } from '../support/support.service';
import { DriverAlertDto } from './dto/driver-alert.dto';

/** O id do motorista vem sempre do token (driver-jwt), nunca do cliente. */
@Controller('driver/safety')
@UseGuards(AuthGuard('driver-jwt'))
export class DriverSafetyController {
  constructor(private readonly support: SupportService) {}

  @Post('alert')
  async alert(@Req() req: any, @Body() dto: DriverAlertDto) {
    const incident = await this.support.createDriverAlert(req.user.driverId, {
      category: dto.category,
      tripRef: dto.tripId,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });
    return { caseNumber: incident.caseNumber, severity: incident.severity, status: incident.status };
  }
}
