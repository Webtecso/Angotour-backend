import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DriverWalletService } from './driver-wallet.service';
import { CreateDriverTopUpDto } from './dto/create-driver-topup.dto';

/** O id do motorista vem sempre do token (driver-jwt), nunca do cliente. */
@Controller('driver/wallet')
@UseGuards(AuthGuard('driver-jwt'))
export class DriverWalletController {
  constructor(private readonly wallet: DriverWalletService) {}

  @Get()
  summary(@Req() req: any) {
    return this.wallet.summary(req.user.driverId);
  }

  @Post('topups')
  startTopUp(@Req() req: any, @Body() dto: CreateDriverTopUpDto) {
    return this.wallet.startTopUp(req.user.driverId, dto.amountKz);
  }

  @Post('topups/:id/confirm')
  confirm(@Req() req: any, @Param('id') id: string) {
    return this.wallet.devConfirm(req.user.driverId, id);
  }
}
