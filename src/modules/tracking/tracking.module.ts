import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [TrackingGateway],
  exports: [TrackingGateway],
})
export class TrackingModule {}