import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FamilyMember } from './entities/family-member.entity';
import { FamilyService } from './family.service';
import { FamilyController } from './family.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FamilyMember])],
  controllers: [FamilyController],
  providers: [FamilyService],
})
export class FamilyModule {}
