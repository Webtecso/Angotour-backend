import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MonthlyService } from './monthly.service';
import { CreateMonthlyRequestDto } from './dto/create-monthly-request.dto';
import { AcceptContractDto } from './dto/accept-contract.dto';

/** Lado do passageiro. A criacao de planos saiu daqui: e so do admin. */
@Controller('monthly')
@UseGuards(AuthGuard('jwt'))
export class MonthlyController {
  constructor(private readonly monthlyService: MonthlyService) {}

  @Get('plans')
  findPlans() {
    return this.monthlyService.findActivePlans();
  }

  @Post('requests')
  createRequest(@Req() req: any, @Body() dto: CreateMonthlyRequestDto) {
    return this.monthlyService.createRequest(req.user.userId, dto);
  }

  @Get('requests/me')
  findMyRequests(@Req() req: any) {
    return this.monthlyService.findMyRequests(req.user.userId);
  }

  @Get('contracts/me')
  findMyContracts(@Req() req: any) {
    return this.monthlyService.findMyContracts(req.user.userId);
  }

  @Get('contracts/:id')
  findOneContract(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.monthlyService.findOneContract(req.user.userId, id);
  }

  @Post('contracts/:id/accept')
  accept(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() _dto: AcceptContractDto) {
    return this.monthlyService.acceptProposal(req.user.userId, id);
  }

  @Post('contracts/:id/reject')
  reject(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.monthlyService.rejectProposal(req.user.userId, id);
  }

﻿  @Get('contracts/:id/cancel-preview')
  cancelPreview(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.monthlyService.cancelPreview(req.user.userId, id);
  }

  @Post('contracts/:id/cancel')
  cancel(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.monthlyService.cancelContract(id, req.user.userId);
  }

  @Post('contracts/:id/renew')
  renew(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.monthlyService.renewContract(req.user.userId, id);
  }

  // Simulado, so em desenvolvimento (ALLOW_DEV_TOPUP_CONFIRM=true).
  @Post('contracts/:id/payment/confirm')
  confirmPayment(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.monthlyService.devConfirmPayment(req.user.userId, id);
  }
}
