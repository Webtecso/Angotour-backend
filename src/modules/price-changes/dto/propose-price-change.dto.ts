import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ProposePriceChangeDto {
  @IsString()
  @MaxLength(60)
  tripRef: string;

  @IsInt()
  @Min(0)
  originalPriceKz: number;

  @IsInt()
  @Min(0)
  proposedPriceKz: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
