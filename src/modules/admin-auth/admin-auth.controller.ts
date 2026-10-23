import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@Controller('admin-auth')
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly audit: AdminAuditService,
  ) {}

  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(AuthGuard('admin-jwt'))
  me(@Req() req: any) {
    return req.user;
  }

  @Get('audit')
  @UseGuards(AuthGuard('admin-jwt'), RolesGuard)
  @Roles('super_admin')
  auditLog(@Query('limit') limit?: string) {
    return this.audit.list(limit ? Number(limit) : 100);
  }
}
