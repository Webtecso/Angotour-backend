import { IsNumber, Max, Min } from 'class-validator';

export class UpdateCommissionDto {
  // Percentagem da corrida, entre 1 e 30, com ate 2 casas decimais.
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(30)
  percent: number;
}
