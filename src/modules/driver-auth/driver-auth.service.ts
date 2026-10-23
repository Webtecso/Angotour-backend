import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DriversService } from '../drivers/drivers.service';
import { OtpService } from '../auth/otp.service';
import { RegisterDriverDto } from './dto/register-driver.dto';

export interface DriverAuthResult {
  accessToken: string;
  isNewDriver: boolean;
  driverId?: string;
}

@Injectable()
export class DriverAuthService {
  constructor(
    private readonly driversService: DriversService,
    private readonly otpService: OtpService,
    private readonly jwtService: JwtService,
  ) {}

  requestOtp(phone: string): { message: string } {
    this.otpService.generateAndStore(phone);
    return { message: 'Codigo enviado por SMS.' };
  }

  async verifyOtp(phone: string, code: string): Promise<DriverAuthResult> {
    const isValid = this.otpService.verify(phone, code);
    if (!isValid) throw new UnauthorizedException('Codigo invalido ou expirado.');

    const existingDriver = await this.driversService.findByPhone(phone);
    if (!existingDriver) {
      return { accessToken: '', isNewDriver: true };
    }

    const accessToken = this.signToken(existingDriver.id, existingDriver.phone);
    return { accessToken, isNewDriver: false, driverId: existingDriver.id };
  }

  async register(dto: RegisterDriverDto): Promise<DriverAuthResult> {
    const existingDriver = await this.driversService.findByPhone(dto.phone);
    if (existingDriver) throw new BadRequestException('Ja existe uma conta de motorista com este numero.');

    const driver = await this.driversService.create(dto);
    const accessToken = this.signToken(driver.id, driver.phone);
    return { accessToken, isNewDriver: false, driverId: driver.id };
  }

  private signToken(driverId: string, phone: string): string {
    return this.jwtService.sign({ sub: driverId, phone, type: 'driver' });
  }
}

