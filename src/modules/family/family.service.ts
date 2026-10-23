import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FamilyMember } from './entities/family-member.entity';
import { CreateFamilyMemberDto } from './dto/create-family-member.dto';

const MAX_MEMBERS = 10;

@Injectable()
export class FamilyService {
  constructor(
    @InjectRepository(FamilyMember)
    private readonly repo: Repository<FamilyMember>,
  ) {}

  list(userId: string): Promise<FamilyMember[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'ASC' } });
  }

  async add(userId: string, dto: CreateFamilyMemberDto): Promise<FamilyMember[]> {
    const count = await this.repo.count({ where: { userId } });
    if (count >= MAX_MEMBERS) throw new BadRequestException('Limite de familiares atingido.');
    await this.repo.save(this.repo.create({ ...dto, userId }));
    return this.list(userId);
  }

  async remove(userId: string, id: string): Promise<FamilyMember[]> {
    await this.repo.delete({ id, userId });
    return this.list(userId);
  }
}
