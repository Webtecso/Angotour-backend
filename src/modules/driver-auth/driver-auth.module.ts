import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DriversModule } from '../drivers/drivers.module';
import { DriverAuthService } from './driver-auth.service';
import { DriverAuthController } from './driver-auth.controller';
import { OtpService } from '../auth/otp.service';
import { DriverJwtStrategy } from './strategies/driver-jwt.strategy';

@Module({
  imports: [
    DriversModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'troca-isto-em-producao',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' },
    }),
  ],
  controllers: [DriverAuthController],
  // OtpService aqui e uma instancia nova e isolada da do passageiro (cada
  // modulo tem a sua propria Map de codigos) - sem partilha nem conflito.
  providers: [DriverAuthService, OtpService, DriverJwtStrategy],
})
export class DriverAuthModule {}
