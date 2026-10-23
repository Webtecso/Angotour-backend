import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripEvent } from './entities/trip-event.entity';
import { TripEventsService } from './trip-events.service';
import { TripEventsController } from './trip-events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TripEvent])],
  controllers: [TripEventsController],
  providers: [TripEventsService],
  exports: [TripEventsService],
})
export class TripEventsModule {}
