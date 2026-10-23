import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUser } from './entities/admin-user.entity';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUser, AdminAuditLog]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'troca-isto-em-producao',
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminAuditService, AdminJwtStrategy, RolesGuard],
  exports: [AdminAuditService, RolesGuard],
})
export class AdminAuthModule {}
