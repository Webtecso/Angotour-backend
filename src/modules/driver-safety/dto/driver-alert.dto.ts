import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const DRIVER_ALERT_CATEGORIES = ['Emergencia', 'Policia', 'Assistencia', 'Acidente', 'Situacao suspeita'];

export class DriverAlertDto {
  @IsIn(DRIVER_ALERT_CATEGORIES)
  category: string;

  @IsOptional() @IsString() @MaxLength(60)
  tripId?: string;

  @IsOptional() @IsNumber() @Min(-90) @Max(90)
  latitude?: number;

  @IsOptional() @IsNumber() @Min(-180) @Max(180)
  longitude?: number;
}
