import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+244\d{9}$/)
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'O codigo deve ter 6 digitos.' })
  code: string;
}
