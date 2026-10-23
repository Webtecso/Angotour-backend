import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCancellationDto {
  @IsString()
  @MaxLength(200)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  tripRef?: string;
}
