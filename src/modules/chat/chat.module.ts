import { Module } from '@nestjs/common';
import { TrackingModule } from '../tracking/tracking.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DriverChatController, PassengerChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [TrackingModule, NotificationsModule],
  controllers: [DriverChatController, PassengerChatController],
  providers: [ChatService],
})
export class ChatModule {}