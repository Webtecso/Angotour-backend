import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PriceChangesService } from './price-changes.service';
import { ProposePriceChangeDto } from './dto/propose-price-change.dto';

@Controller('price-changes')
@UseGuards(AuthGuard('jwt'))
export class PriceChangesController {
  constructor(private readonly service: PriceChangesService) {}

  @Post()
  propose(@Req() req: any, @Body() dto: ProposePriceChangeDto) {
    return this.service.propose(req.user.userId, dto);
  }

  @Patch(':id/report')
  report(@Req() req: any, @Param('id') id: string) {
    return this.service.report(req.user.userId, id);
  }

  @Get('trip/:tripRef')
  forTrip(@Req() req: any, @Param('tripRef') tripRef: string) {
    return this.service.listForTrip(req.user.userId, tripRef);
  }
}

