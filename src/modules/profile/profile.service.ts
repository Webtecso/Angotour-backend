import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfile } from './entities/user-profile.entity';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(UserProfile)
    private readonly profiles: Repository<UserProfile>,
  ) {}

  async getOrCreate(userId: string): Promise<UserProfile> {
    let profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      await this.profiles.query(
        `INSERT INTO user_profiles ("userId","isVerified","angoPoints") VALUES ($1,false,0) ON CONFLICT ("userId") DO NOTHING`,
        [userId],
      );
      profile = await this.profiles.findOneOrFail({ where: { userId } });
    }
    return profile;
  }

  /**
   * Submete BI + selfie para revisao. NUNCA auto-aprova: fica "pending" ate um
   * revisor confirmar no Admin (Document Center). isVerified so passa a true
   * quando esse fluxo (ainda por construir) chamar approveVerification().
   */
  async verifyIdentity(userId: string): Promise<UserProfile> {
    const profile = await this.getOrCreate(userId);
    if (profile.verificationStatus !== 'verified') {
      profile.verificationStatus = 'pending';
    }
    return this.profiles.save(profile);
  }

  async approveVerification(userId: string): Promise<UserProfile> {
    const profile = await this.getOrCreate(userId);
    profile.isVerified = true;
    profile.verificationStatus = 'verified';
    profile.verifiedAt = new Date();
    return this.profiles.save(profile);
  }
}

