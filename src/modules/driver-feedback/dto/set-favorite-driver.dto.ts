import { IsString, MaxLength } from 'class-validator';

export class SetFavoriteDriverDto {
  @IsString()
  @MaxLength(60)
  driverId: string;

  @IsString()
  @MaxLength(120)
  driverName: string;
}
