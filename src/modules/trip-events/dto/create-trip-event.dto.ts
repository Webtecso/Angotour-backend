import { IsDateString, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export const TRIP_EVENT_TYPES = [
  'trip_created',
  'driver_assigned',
  'ride_started',
  'price_change_proposed',
  'price_change_accepted',
  'price_change_reported',
  'sos_triggered',
  'quick_message_sent',
  'cancelled',
  'completed',
];

export class CreateTripEventDto {
  @IsString()
  @MaxLength(60)
  tripRef: string;

  @IsIn(TRIP_EVENT_TYPES)
  type: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, string | number>;

  @IsOptional()
  @IsDateString()
  clientAt?: string;
}
