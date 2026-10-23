import { IsString, Matches, MinLength } from 'class-validator';

export class RegisterDriverDto {
  @IsString()
  @Matches(/^\+244\d{9}$/, { message: 'Numero de telefone invalido. Formato esperado: +244923456789' })
  phone: string;

  @IsString()
  @MinLength(3)
  fullName: string;
}
