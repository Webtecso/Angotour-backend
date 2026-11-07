import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateVehicleInspectionDto {
  @IsUUID()
  vehicleId: string;

  @IsString() @MinLength(2) @MaxLength(120)
  inspectorName: string;

  @IsBoolean() tiresOk: boolean;
  @IsBoolean() brakesOk: boolean;
  @IsBoolean() lightsOk: boolean;
  @IsBoolean() acOk: boolean;
  @IsBoolean() documentationOk: boolean;

  @IsOptional() @IsString() @MaxLength(300)
  notes?: string;

  @IsOptional() @IsDateString()
  nextDueDate?: string;
}
