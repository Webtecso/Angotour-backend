import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Cancellation } from './entities/cancellation.entity';

export type CancellationRiskLevel = 'legitimo' | 'a_monitorizar' | 'suspeito';

const WINDOW_DAYS = 30;

@Injectable()
export class CancellationsService {
  constructor(
    @InjectRepository(Cancellation)
    private readonly repo: Repository<Cancellation>,
  ) {}

  /** Cancelamento Inteligente: classifica pelo numero de cancelamentos nos ultimos 30 dias. */
  private classify(recentCount: number): CancellationRiskLevel {
    if (recentCount >= 5) return 'suspeito';
    if (recentCount >= 3) return 'a_monitorizar';
    return 'legitimo';
  }

  private since(): Date {
    return new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  }

  async record(userId: string, reason: string, tripRef?: string) {
    const previous = await this.repo.count({ where: { userId, createdAt: MoreThan(this.since()) } });
    const recentCount = previous + 1;
    const risk = this.classify(recentCount);
    await this.repo.save(this.repo.create({ userId, tripRef, reason, risk }));
    return { risk, recentCount };
  }

  async currentRisk(userId: string) {
    const recentCount = await this.repo.count({ where: { userId, createdAt: MoreThan(this.since()) } });
    return { risk: this.classify(recentCount), recentCount };
  }
}
