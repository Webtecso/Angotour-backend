import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FamilyService } from './family.service';
import { CreateFamilyMemberDto } from './dto/create-family-member.dto';

@Controller('family')
@UseGuards(AuthGuard('jwt'))
export class FamilyController {
  constructor(private readonly service: FamilyService) {}

  @Get()
  list(@Req() req: any) {
    return this.service.list(req.user.userId);
  }

  @Post()
  add(@Req() req: any, @Body() dto: CreateFamilyMemberDto) {
    return this.service.add(req.user.userId, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req.user.userId, id);
  }
}
