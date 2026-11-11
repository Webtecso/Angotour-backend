import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DriverExtrasService } from './driver-extras.service';

/** O id do motorista vem sempre do token (driver-jwt). */
@Controller('driver/extras')
@UseGuards(AuthGuard('driver-jwt'))
export class DriverExtrasController {
  constructor(private readonly svc: DriverExtrasService) {}

  @Get('lost-items') lost(@Req() req: any) { return this.svc.lostItems(req.user.driverId); }
  @Post('lost-items') report(@Req() req: any, @Body() b: any) { return this.svc.reportLostItem(req.user.driverId, b); }
  @Get('demand') demand() { return this.svc.demand(); }
  @Get('incentives') incentives(@Req() req: any) { return this.svc.incentives(req.user.driverId); }
﻿  @Get('ratings') ratings(@Req() req: any) { return this.svc.ratings(req.user.driverId); }
  @Get('support') supportList(@Req() req: any) { return this.svc.supportList(req.user.driverId); }
  @Post('support') supportCreate(@Req() req: any, @Body() b: any) { return this.svc.supportCreate(req.user.driverId, b); }
  @Get('tourism') tourism(@Req() req: any) { return this.svc.tourism(req.user.driverId); }
  @Post('tourism/languages') langs(@Req() req: any, @Body() b: any) { return this.svc.setTourismLanguages(req.user.driverId, b); }
  @Post('tourism/active') active(@Req() req: any, @Body() b: any) { return this.svc.setTourismActive(req.user.driverId, b); }
}