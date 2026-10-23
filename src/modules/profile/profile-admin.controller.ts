import { Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../../common/guards/admin-key.guard';
import { ProfileService } from './profile.service';

/**
 * Rota minima de aprovacao de identidade, enquanto nao existe um Admin/Document
 * Center a serio. Protegida so por chave de administrador (ver AdminKeyGuard) -
 * nao por sessao de utilizador, porque quem aprova nao e um passageiro.
 */
@Controller('admin/profile')
@UseGuards(AdminKeyGuard)
export class ProfileAdminController {
  constructor(private readonly profileService: ProfileService) {}

  @Patch(':userId/approve-verification')
  async approve(@Param('userId') userId: string) {
    const p = await this.profileService.approveVerification(userId);
    return { isVerified: p.isVerified, verificationStatus: p.verificationStatus };
  }
}
