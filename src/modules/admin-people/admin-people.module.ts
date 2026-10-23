import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AdminPeopleController } from './admin-people.controller';
import { AdminPeopleService } from './admin-people.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminPeopleController],
  providers: [AdminPeopleService],
})
export class AdminPeopleModule {}
