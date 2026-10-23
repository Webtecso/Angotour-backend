import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateFamilyMemberDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(6)
  @MaxLength(30)
  phone: string;

  @IsString()
  @MaxLength(40)
  relationship: string;
}
