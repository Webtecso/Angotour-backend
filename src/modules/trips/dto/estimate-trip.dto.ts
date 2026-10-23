import { Type } from 'class-transformer';
import { IsNumber, ValidateNested } from 'class-validator';

class CoordinatesDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;
}

export class EstimateTripDto {
  @ValidateNested()
  @Type(() => CoordinatesDto)
  origin: CoordinatesDto;

  @ValidateNested()
  @Type(() => CoordinatesDto)
  destination: CoordinatesDto;
}
