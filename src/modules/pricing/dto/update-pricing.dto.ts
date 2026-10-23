import { IsInt, Max, Min } from 'class-validator';

export class UpdatePricingDto {
  @IsInt() @Min(0) @Max(20000)
  tarifaBaseKz: number;

  @IsInt() @Min(1) @Max(5000)
  precoPorKmKz: number;

  @IsInt() @Min(0) @Max(500)
  precoPorMinKz: number;

  @IsInt() @Min(0) @Max(50000)
  tarifaMinimaKz: number;

  @IsInt() @Min(5) @Max(120)
  velocidadeMediaKmh: number;
}
