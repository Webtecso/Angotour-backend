import { Body, Controller, Post } from '@nestjs/common';
import { DriverAuthService } from './driver-auth.service';
import { RequestOtpDto } from '../auth/dto/request-otp.dto';
import { VerifyOtpDto } from '../auth/dto/verify-otp.dto';
import { RegisterDriverDto } from './dto/register-driver.dto';

@Controller('driver-auth')
export class DriverAuthController {
  constructor(private readonly driverAuthService: DriverAuthService) {}

  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.driverAuthService.requestOtp(dto.phone);
  }

  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.driverAuthService.verifyOtp(dto.phone, dto.code);
  }

  @Post('register')
  register(@Body() dto: RegisterDriverDto) {
    return this.driverAuthService.register(dto);
  }
}
