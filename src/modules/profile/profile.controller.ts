import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProfileService } from './profile.service';

@Controller('profile')
@UseGuards(AuthGuard('jwt'))
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  async me(@Req() req: any) {
    const p = await this.profileService.getOrCreate(req.user.userId);
    return { isVerified: p.isVerified, angoPoints: p.angoPoints, verificationStatus: p.verificationStatus };
  }

  @Post('verify-identity')
  async verify(@Req() req: any) {
    const p = await this.profileService.verifyIdentity(req.user.userId);
    return { isVerified: p.isVerified, angoPoints: p.angoPoints, verificationStatus: p.verificationStatus };
  }

  @Patch('push-token')
  setPushToken(@Req() req: any, @Body('pushToken') pushToken: string) {
    return this.profileService.setPushToken(req.user.userId, pushToken);
  }
}