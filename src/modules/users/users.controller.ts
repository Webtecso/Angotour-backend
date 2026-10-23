import { Body, Controller, ForbiddenException, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // "me" tem de vir antes de ":id", senao o Nest trata "me" como um id.
  @Get('me')
  findMe(@Req() req: any) {
    return this.usersService.findByIdOrFail(req.user.userId);
  }

  @Patch('me')
  updateMe(@Req() req: any, @Body() dto: UpdateUserDto) {
    return this.usersService.update(req.user.userId, dto);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    if (id !== req.user.userId) throw new ForbiddenException();
    return this.usersService.findByIdOrFail(id);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    if (id !== req.user.userId) throw new ForbiddenException();
    return this.usersService.update(id, dto);
  }
}
