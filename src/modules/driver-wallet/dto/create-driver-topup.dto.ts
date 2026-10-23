import { IsInt, Max, Min } from 'class-validator';

export class CreateDriverTopUpDto {
  @IsInt()
  @Min(500)
  @Max(500000)
  amountKz: number;
}
