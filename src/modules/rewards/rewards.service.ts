import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RewardRedemption } from './entities/reward-redemption.entity';
import { REWARDS_CATALOG } from './rewards.catalog';

function makeCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `AT-${s}`;
}

@Injectable()
export class RewardsService {
  constructor(
    @InjectRepository(RewardRedemption)
    private readonly repo: Repository<RewardRedemption>,
  ) {}

  async list(userId: string) {
    const redeemed = await this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
    return { catalog: REWARDS_CATALOG, redeemed };
  }

  /** Transacao: bloqueia a linha de pontos, confirma saldo, desconta e regista o voucher. */
  async redeem(userId: string, rewardId: string) {
    const reward = REWARDS_CATALOG.find((r) => r.id === rewardId);
    if (!reward) throw new NotFoundException('Recompensa nao encontrada.');

    return this.repo.manager.transaction(async (m) => {
      const rows = await m.query(`SELECT "angoPoints" FROM user_profiles WHERE "userId" = $1 FOR UPDATE`, [userId]);
      const points = Number(rows[0]?.angoPoints ?? 0);
      if (points < reward.costPoints) throw new BadRequestException('Pontos insuficientes.');

      await m.query(`UPDATE user_profiles SET "angoPoints" = "angoPoints" - $2 WHERE "userId" = $1`, [
        userId,
        reward.costPoints,
      ]);
      const redemption = await m.save(
        m.create(RewardRedemption, {
          userId,
          rewardId: reward.id,
          title: reward.title,
          costPoints: reward.costPoints,
          code: makeCode(),
        }),
      );
      return { redemption, angoPoints: points - reward.costPoints };
    });
  }
}
