import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WalletService } from './wallet.service';
import { CreateTopUpDto } from './dto/create-topup.dto';

@Controller('wallet')
@UseGuards(AuthGuard('jwt'))
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  summary(@Req() req: any) {
    return this.walletService.summary(req.user.userId);
  }

  @Post('topups')
  start(@Req() req: any, @Body() dto: CreateTopUpDto) {
    return this.walletService.startTopUp(req.user.userId, dto.amountKz);
  }

  @Post('topups/:id/confirm')
  confirm(@Req() req: any, @Param('id') id: string) {
    return this.walletService.devConfirm(req.user.userId, id);
  }
}
