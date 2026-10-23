import { IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { PreferredLanguage } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  fullName: string;

  @IsString()
  @Matches(/^\+244\d{9}$/, { message: 'Numero de telefone invalido. Formato esperado: +244923456789' })
  phone: string;

  @IsOptional()
  @IsString()
  birthDate?: string;

  @IsEnum(PreferredLanguage)
  preferredLanguage: PreferredLanguage;
}
