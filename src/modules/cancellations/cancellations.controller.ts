import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CancellationsService } from './cancellations.service';
import { CreateCancellationDto } from './dto/create-cancellation.dto';

@Controller('cancellations')
@UseGuards(AuthGuard('jwt'))
export class CancellationsController {
  constructor(private readonly service: CancellationsService) {}

  @Post()
  record(@Req() req: any, @Body() dto: CreateCancellationDto) {
    return this.service.record(req.user.userId, dto.reason, dto.tripRef);
  }

  @Get('risk')
  risk(@Req() req: any) {
    return this.service.currentRisk(req.user.userId);
  }
}
