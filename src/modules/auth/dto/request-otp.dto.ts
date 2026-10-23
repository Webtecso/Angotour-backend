import { IsString, Matches } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @Matches(/^\+244\d{9}$/, { message: 'Numero de telefone invalido. Formato esperado: +244923456789' })
  phone: string;
}
