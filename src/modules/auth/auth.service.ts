import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { OtpService } from './otp.service';
import { RegisterDto } from './dto/register.dto';

export interface AuthResult {
  accessToken: string;
  isNewUser: boolean;
  userId?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly jwtService: JwtService,
  ) {}

  requestOtp(phone: string): { message: string } {
    this.otpService.generateAndStore(phone);
    return { message: 'Codigo enviado por SMS.' };
  }

  async verifyOtp(phone: string, code: string): Promise<AuthResult> {
    const isValid = this.otpService.verify(phone, code);
    if (!isValid) throw new UnauthorizedException('Codigo invalido ou expirado.');

    const existingUser = await this.usersService.findByPhone(phone);
    if (!existingUser) {
      return { accessToken: '', isNewUser: true };
    }

    const accessToken = this.signToken(existingUser.id, existingUser.phone);
    return { accessToken, isNewUser: false, userId: existingUser.id };
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existingUser = await this.usersService.findByPhone(dto.phone);
    if (existingUser) throw new BadRequestException('Ja existe uma conta com este numero.');

    const user = await this.usersService.create(dto);
    const accessToken = this.signToken(user.id, user.phone);
    return { accessToken, isNewUser: false, userId: user.id };
  }

  private signToken(userId: string, phone: string): string {
    return this.jwtService.sign({ sub: userId, phone });
  }
}
