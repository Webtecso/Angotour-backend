import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateRatingDto {
  @IsString()
  @MaxLength(60)
  tripRef: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  driverId?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  stars: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
