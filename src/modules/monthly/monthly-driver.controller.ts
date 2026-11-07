import { Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MonthlyExecutionsService } from './monthly-executions.service';

/** Servicos mensais do motorista. O id do motorista vem sempre do token (driver-jwt). */
@Controller('driver/monthly')
@UseGuards(AuthGuard('driver-jwt'))
export class MonthlyDriverController {
  constructor(private readonly executions: MonthlyExecutionsService) {}

  @Get('executions')
  upcoming(@Req() req: any) {
    return this.executions.driverUpcoming(req.user.driverId);
  }

  @Post('executions/:id/start')
  start(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.executions.start(req.user.driverId, id);
  }

  @Post('executions/:id/complete')
  complete(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.executions.complete(req.user.driverId, id);
  }
}
