import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateMonthlyPricingDto {
  @IsOptional() @IsNumber() @Min(0) @Max(100000) fuelCostPerKmKz?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100000) maintenancePerKmKz?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10000000) driverPayPerTripKz?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000000) insuranceDocsMonthlyKz?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000000) otherCostsMonthlyKz?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10000000) availabilityPerHourKz?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(3) roadFactor?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(200) marginPercent?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) riskReservePercent?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1000000000) minPriceKz?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1000000000) maxPriceKz?: number;
  @IsOptional() @IsBoolean() enforceViability?: boolean;
}
