import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { MonthlyModality } from '../entities/monthly-plan.entity';

const DAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

export class CreateMonthlyRequestDto {
  @IsIn(['shared', 'individual'])
  modality: MonthlyModality;

  @IsString() @MaxLength(160)
  originLabel: string;

  @IsLatitude()
  originLatitude: number;

  @IsLongitude()
  originLongitude: number;

  @IsString() @MaxLength(160)
  destinationLabel: string;

  @IsLatitude()
  destinationLatitude: number;

  @IsLongitude()
  destinationLongitude: number;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(7) @IsIn(DAYS, { each: true })
  preferredDays: string[];

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Hora de ida invalida (HH:MM).' })
  departureTime: string;

  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Hora de regresso invalida (HH:MM).' })
  returnTime?: string;

  @IsDateString()
  startDate: string;

  @IsOptional() @IsInt() @Min(1) @Max(15)
  passengerCount?: number;

  @IsOptional() @IsString() @MaxLength(300)
  specialNeeds?: string;
}
