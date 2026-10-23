import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { VehicleCategoryId } from '../../vehicles/entities/vehicle.entity';

class TripPointDto {
  @IsString()
  label: string;

  @IsString()
  address: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class CreateTripDto {
  @ValidateNested()
  @Type(() => TripPointDto)
  origin: TripPointDto;

  @ValidateNested()
  @Type(() => TripPointDto)
  destination: TripPointDto;

  @IsEnum(VehicleCategoryId)
  categoryId: VehicleCategoryId;

  @IsOptional()
  @IsString()
  scheduledFor?: string;

  @IsOptional()
  @IsIn(['wallet', 'multicaixa_express', 'unitel_money', 'card', 'cash'])
  paymentMethodType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  cashNoteKz?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  comfortPreferences?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  splitCount?: number;

  @IsOptional()
  @IsObject()
  airportPickup?: { terminal: string; pickupPoint: string };

  @IsOptional()
  @IsBoolean()
  womenMode?: boolean;
}
