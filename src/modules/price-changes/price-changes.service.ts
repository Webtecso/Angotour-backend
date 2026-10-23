import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceChange } from './entities/price-change.entity';
import { ProposePriceChangeDto } from './dto/propose-price-change.dto';

@Injectable()
export class PriceChangesService {
  constructor(
    @InjectRepository(PriceChange)
    private readonly repo: Repository<PriceChange>,
  ) {}

  propose(userId: string, dto: ProposePriceChangeDto): Promise<PriceChange> {
    return this.repo.save(this.repo.create({ ...dto, userId, status: 'proposta' }));
  }

  private async resolve(userId: string, id: string, status: 'reportada'): Promise<PriceChange> {
    const change = await this.repo.findOne({ where: { id, userId } });
    if (!change) throw new NotFoundException('Proposta nao encontrada.');
    if (change.status !== 'proposta') throw new BadRequestException('Esta proposta ja foi resolvida.');
    change.status = status;
    change.resolvedAt = new Date();
    return this.repo.save(change);
  }

  report(userId: string, id: string) {
    return this.resolve(userId, id, 'reportada');
  }

  listForTrip(userId: string, tripRef: string): Promise<PriceChange[]> {
    return this.repo.find({ where: { userId, tripRef }, order: { createdAt: 'ASC' } });
  }
}

