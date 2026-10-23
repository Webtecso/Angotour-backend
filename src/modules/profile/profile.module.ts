import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProfile } from './entities/user-profile.entity';
import { ProfileController } from './profile.controller';
import { ProfileAdminController } from './profile-admin.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserProfile])],
  controllers: [ProfileController, ProfileAdminController],
  providers: [ProfileService],
})
export class ProfileModule {}

