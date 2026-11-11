import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChatService } from './chat.service';

/** Motorista: o id vem sempre do token (driver-jwt). */
@Controller('driver/chat/trips/:tripId/messages')
@UseGuards(AuthGuard('driver-jwt'))
export class DriverChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  list(@Req() req: any, @Param('tripId') tripId: string) {
    return this.chat.list('driver', req.user.driverId, tripId);
  }

  @Post()
  send(@Req() req: any, @Param('tripId') tripId: string, @Body() dto: { body?: string }) {
    return this.chat.send('driver', req.user.driverId, tripId, dto?.body ?? '');
  }
}

/** Passageiro: o id vem sempre do token (jwt). */
@Controller('chat/trips/:tripId/messages')
@UseGuards(AuthGuard('jwt'))
export class PassengerChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  list(@Req() req: any, @Param('tripId') tripId: string) {
    return this.chat.list('passenger', req.user.userId, tripId);
  }

  @Post()
  send(@Req() req: any, @Param('tripId') tripId: string, @Body() dto: { body?: string }) {
    return this.chat.send('passenger', req.user.userId, tripId, dto?.body ?? '');
  }
}