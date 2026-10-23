import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SupportService } from './support.service';
import { CreateIncidentDto } from './dto/create-incident.dto';

@Controller('support')
@UseGuards(AuthGuard('jwt'))
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('incidents')
  create(@Req() req: any, @Body() dto: CreateIncidentDto) {
    return this.supportService.create(req.user.userId, dto);
  }

  // "me" antes de ":caseNumber"
  @Get('incidents/me')
  findMine(@Req() req: any) {
    return this.supportService.findMine(req.user.userId);
  }

  @Get('incidents/:caseNumber')
  findOne(@Req() req: any, @Param('caseNumber') caseNumber: string) {
    return this.supportService.findOneMine(req.user.userId, caseNumber);
  }
}
