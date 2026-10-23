import { IsEnum, IsInt, IsString, Length, Max, Min } from 'class-validator';
import { VehicleCategoryId } from '../../../common/vehicle-category.enum';

export class SaveVehicleDto {
  @IsString()
  @Length(2, 60)
  model: string;

  @IsString()
  @Length(4, 20)
  plate: string;

  @IsString()
  @Length(2, 30)
  color: string;

  @IsEnum(VehicleCategoryId)
  categoryId: VehicleCategoryId;

  @IsInt()
  @Min(1)
  @Max(15)
  capacity: number;
}
