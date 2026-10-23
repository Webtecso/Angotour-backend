import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletTopUp } from './entities/wallet-topup.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletTopUp)
    private readonly topUps: Repository<WalletTopUp>,
  ) {}

  /** saldo = carregamentos confirmados - viagens concluidas pagas com a carteira */
  async summary(userId: string) {
    const list = await this.topUps.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 });
    const confirmed = list.filter((t) => t.status === 'confirmed').reduce((s, t) => s + t.amountKz, 0);
    const spentRows = await this.topUps.query(
      `SELECT COALESCE(SUM("priceKz"),0) AS spent FROM trips WHERE "passengerId" = $1 AND status = 'completed' AND "paymentMethodType" = 'wallet'`,
      [userId],
    );
    const spent = Number(spentRows[0]?.spent ?? 0);
    return {
      balanceKz: confirmed - spent,
      topups: list.map((t) => ({ id: t.id, amountKz: t.amountKz, reference: t.reference, status: t.status, createdAt: t.createdAt })),
    };
  }

  async startTopUp(userId: string, amountKz: number): Promise<WalletTopUp> {
    const reference = `9${Math.floor(10000000 + Math.random() * 89999999)}`;
    return this.topUps.save(this.topUps.create({ userId, amountKz, reference, status: 'processing' }));
  }

  /**
   * SO DESENVOLVIMENTO: simula a confirmacao do Multicaixa. Em producao a confirmacao
   * vem de um webhook assinado do fornecedor de pagamentos - nunca do proprio cliente.
   * Bloqueado por omissao: exige ALLOW_DEV_TOPUP_CONFIRM=true explicito no .env, para
   * nunca depender de NODE_ENV estar (ou nao) configurado corretamente em producao.
   */
  async devConfirm(userId: string, id: string): Promise<WalletTopUp> {
    if (process.env.ALLOW_DEV_TOPUP_CONFIRM !== 'true') throw new ForbiddenException();
    const topUp = await this.topUps.findOne({ where: { id, userId } });
    if (!topUp) throw new NotFoundException('Carregamento nao encontrado.');
    topUp.status = 'confirmed';
    return this.topUps.save(topUp);
  }
}

