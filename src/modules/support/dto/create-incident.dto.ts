import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateIncidentDto {
  @IsIn(['incident', 'lost_item', 'sos'])
  kind: 'incident' | 'lost_item' | 'sos';

  @IsString()
  @MaxLength(80)
  category: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  tripRef?: string;
}

