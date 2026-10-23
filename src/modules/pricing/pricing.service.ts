import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CATEGORY_PRICING } from '../../common/vehicle-categories';
import { getCommissionRate, setCommissionRate } from '../../common/platform-config';
import { PricingRule } from './entities/pricing-rule.entity';
import { PlatformSetting } from './entities/platform-setting.entity';
import { SettingsHistory } from './entities/settings-history.entity';
import { UpdatePricingDto } from './dto/update-pricing.dto';

const FIELDS = ['tarifaBaseKz', 'precoPorKmKz', 'precoPorMinKz', 'tarifaMinimaKz', 'velocidadeMediaKmh'] as const;
type Field = (typeof FIELDS)[number];
type Values = Record<Field, number>;

const COMMISSION_KEY = 'commission_rate';
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface AdminActor {
  adminId?: string | null;
  adminEmail?: string | null;
}

@Injectable()
export class PricingService implements OnModuleInit {
  constructor(
    @InjectRepository(PricingRule) private readonly rules: Repository<PricingRule>,
    @InjectRepository(PlatformSetting) private readonly settings: Repository<PlatformSetting>,
    @InjectRepository(SettingsHistory) private readonly history: Repository<SettingsHistory>,
  ) {}

  /** Aplica ao codigo as tarifas e a comissao guardadas na base de dados. */
  async onModuleInit(): Promise<void> {
    try {
      for (const r of await this.rules.find()) this.apply(r.categoryId, r);
      const s = await this.settings.findOne({ where: { key: COMMISSION_KEY } });
      if (s) {
        const rate = Number(s.value);
        if (Number.isFinite(rate) && rate >= 0.01 && rate <= 0.3) setCommissionRate(rate);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[Pricing] nao foi possivel carregar as configuracoes:', (e as Error).message);
    }
  }

  private values(categoryId: string): Values | null {
    const c = (CATEGORY_PRICING as any)[categoryId];
    if (!c) return null;
    return {
      tarifaBaseKz: c.tarifaBaseKz,
      precoPorKmKz: c.precoPorKmKz,
      precoPorMinKz: c.precoPorMinKz,
      tarifaMinimaKz: c.tarifaMinimaKz,
      velocidadeMediaKmh: c.velocidadeMediaKmh,
    };
  }

  private apply(categoryId: string, v: Values): void {
    const c = (CATEGORY_PRICING as any)[categoryId];
    if (!c) return;
    c.tarifaBaseKz = v.tarifaBaseKz;
    c.precoPorKmKz = v.precoPorKmKz;
    c.precoPorMinKz = v.precoPorMinKz;
    c.tarifaMinimaKz = v.tarifaMinimaKz;
    c.velocidadeMediaKmh = v.velocidadeMediaKmh;
    c.basePricePerKm = v.precoPorKmKz; // compatibilidade com codigo antigo
  }

  /** Tarifas atuais, publicas (a app do passageiro usa-as para a estimativa). */
  publicPricing() {
    return Object.values(CATEGORY_PRICING).map((c) => ({
      id: c.id,
      name: c.name,
      tarifaBaseKz: c.tarifaBaseKz,
      precoPorKmKz: c.precoPorKmKz,
      precoPorMinKz: c.precoPorMinKz,
      tarifaMinimaKz: c.tarifaMinimaKz,
      velocidadeMediaKmh: c.velocidadeMediaKmh,
    }));
  }

  async overview() {
    const history = await this.history.find({ order: { createdAt: 'DESC' }, take: 30 });
    return {
      commissionPercent: round2(getCommissionRate() * 100),
      categories: this.publicPricing(),
      history,
    };
  }

  async updateCommission(percent: number, actor: AdminActor) {
    const from = round2(getCommissionRate() * 100);
    const to = round2(percent);
    if (from === to) return { changed: false, from, to };

    await this.settings.save(this.settings.create({ key: COMMISSION_KEY, value: String(to / 100) }));
    setCommissionRate(to / 100);
    await this.history.save(
      this.history.create({
        kind: 'commission', target: COMMISSION_KEY,
        oldValue: { percent: from }, newValue: { percent: to },
        adminId: actor.adminId ?? null, adminEmail: actor.adminEmail ?? null,
      }),
    );
    return { changed: true, from, to };
  }

  async updatePricing(categoryId: string, dto: UpdatePricingDto, actor: AdminActor) {
    const before = this.values(categoryId);
    if (!before) throw new NotFoundException('Categoria nao encontrada.');
    const after: Values = {
      tarifaBaseKz: dto.tarifaBaseKz,
      precoPorKmKz: dto.precoPorKmKz,
      precoPorMinKz: dto.precoPorMinKz,
      tarifaMinimaKz: dto.tarifaMinimaKz,
      velocidadeMediaKmh: dto.velocidadeMediaKmh,
    };
    if (FIELDS.every((f) => before[f] === after[f])) return { changed: false, before, after };

    await this.rules.save(this.rules.create({ categoryId, ...after }));
    this.apply(categoryId, after);
    await this.history.save(
      this.history.create({
        kind: 'pricing', target: categoryId,
        oldValue: before as any, newValue: after as any,
        adminId: actor.adminId ?? null, adminEmail: actor.adminEmail ?? null,
      }),
    );
    return { changed: true, before, after };
  }
}
