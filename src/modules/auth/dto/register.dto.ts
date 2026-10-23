import { IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { PreferredLanguage } from '../../users/entities/user.entity';

export class RegisterDto {
  @IsString()
  @Matches(/^\+244\d{9}$/)
  phone: string;

  @IsString()
  @MinLength(3)
  fullName: string;

  @IsOptional()
  @IsString()
  birthDate?: string;

  @IsEnum(PreferredLanguage)
  preferredLanguage: PreferredLanguage;
}
