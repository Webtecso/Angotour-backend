import { BadRequestException, ForbiddenException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

const DAILY_GOAL_KZ = 20000; // provisorio: passa para as definicoes do painel
const MIN_TOURISM_RATING = 4.7;
const MIN_TOURISM_LANGUAGES = 2;
const LANGUAGES = ['Portugues', 'Ingles', 'Frances', 'Espanhol', 'Umbundu', 'Kimbundu', 'Kikongo'];

const LOST_LABEL: Record<string, string> = {
  phone: 'Telemovel', wallet: 'Carteira', documents: 'Documentos', clothing: 'Roupa', other: 'Outro',
};
const LABEL_TO_ID = Object.fromEntries(Object.entries(LOST_LABEL).map(([k, v]) => [v, k]));

function lostStatus(s: string): 'reported' | 'matched' | 'returned' {
  if (s === 'resolvido') return 'returned';
  if (s === 'recebido') return 'reported';
  return 'matched';
}

@Injectable()
export class DriverExtrasService implements OnModuleInit {
  private readonly logger = new Logger('DriverExtras');
  constructor(private readonly db: DataSource) {}

  async onModuleInit() {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS driver_tourism (
        "driverId" uuid PRIMARY KEY REFERENCES drivers(id) ON DELETE CASCADE,
        languages text NOT NULL DEFAULT '',
        "trainingCompleted" boolean NOT NULL DEFAULT false,
        active boolean NOT NULL DEFAULT false,
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    this.logger.log('Tabela driver_tourism pronta.');
  }

  // ---------- Objetos perdidos ----------
  async lostItems(driverId: string) {
    const rows = await this.db.query(
      `SELECT id, category, description, "tripRef", status, "createdAt" FROM incidents
       WHERE "userId" = $1 AND "reporterType" = 'driver' AND kind = 'lost_item'
       ORDER BY "createdAt" DESC LIMIT 50`,
      [driverId],
    );
    return rows.map((r: any) => ({
      id: r.id,
      category: LABEL_TO_ID[r.category] ?? 'other',
      description: r.description,
      tripRef: r.tripRef ?? undefined,
      dateIso: new Date(r.createdAt).toISOString(),
      status: lostStatus(r.status),
    }));
  }

  async reportLostItem(driverId: string, body: { category?: string; description?: string }) {
    const label = LOST_LABEL[String(body?.category)];
    const description = String(body?.description ?? '').trim();
    if (!label) throw new BadRequestException('Categoria invalida.');
    if (description.length < 5 || description.length > 500) throw new BadRequestException('A descricao deve ter entre 5 e 500 caracteres.');
    const year = new Date().getFullYear();
    for (let i = 0; i < 6; i++) {
      const caseNumber = `AT-${year}-${Math.floor(100000 + Math.random() * 900000)}`;
      try {
        await this.db.query(
          `INSERT INTO incidents ("caseNumber","userId",kind,category,description,status,severity,"isLiveShare","reporterType")
           VALUES ($1,$2,'lost_item',$3,$4,'recebido','normal',false,'driver')`,
          [caseNumber, driverId, label, description],
        );
        return { caseNumber };
      } catch (e: any) {
        if (e?.code !== '23505') throw e;
      }
    }
    throw new BadRequestException('Nao foi possivel registar. Tenta outra vez.');
  }

  // ---------- Mapa de procura (agregado, anonimo) ----------
  async demand() {
    const cells = await this.db.query(
      `SELECT round(((origin->>'latitude')::numeric)/0.02)*0.02 AS lat,
              round(((origin->>'longitude')::numeric)/0.02)*0.02 AS lng,
              COUNT(*)::int AS n
       FROM trips
       WHERE "createdAt" > now() - interval '14 days' AND origin->>'latitude' IS NOT NULL AND origin->>'longitude' IS NOT NULL
       GROUP BY 1,2 ORDER BY n DESC LIMIT 30`,
    );
    const max = cells[0]?.n ?? 0;
    const zones = cells.map((c: any) => {
      const f = max ? c.n / max : 0;
      return { latitude: Number(c.lat), longitude: Number(c.lng), radiusMeters: 1200, intensity: f >= 0.66 ? 'high' : f >= 0.33 ? 'medium' : 'normal' };
    });
    const total = cells.reduce((s: number, c: any) => s + c.n, 0);
    let forecast: string | null = null;
    if (total >= 5) {
      const h = await this.db.query(
        `SELECT EXTRACT(hour FROM "createdAt" AT TIME ZONE 'Africa/Luanda')::int AS h, COUNT(*)::int AS n
         FROM trips WHERE "createdAt" > now() - interval '14 days' GROUP BY 1 ORDER BY n DESC LIMIT 1`,
      );
      if (h[0]) forecast = `Nos ultimos 14 dias, a procura foi maior por volta das ${String(h[0].h).padStart(2, '0')}h.`;
    }
    return { zones, forecast };
  }

  // ---------- Incentivos ----------
  async incentives(driverId: string) {
    const g = await this.db.query(
      `SELECT COALESCE(SUM("priceKz"),0)::int AS gross, COUNT(*)::int AS n FROM trips
       WHERE "driverId" = $1 AND status::text = 'completed' AND "completedAt" >= date_trunc('day', now())`,
      [driverId],
    );
    const c = await this.db.query(
      `SELECT COALESCE(SUM("amountKz"),0)::int AS total FROM driver_wallet_entries
       WHERE "driverId" = $1 AND kind = 'commission' AND status = 'settled' AND "settledAt" >= date_trunc('day', now())`,
      [driverId],
    );
    const w = await this.db.query(
      `SELECT COUNT(*)::int AS n, ((date_trunc('week', now()) + interval '7 days')::date - now()::date)::int AS left
       FROM trips WHERE "driverId" = $1 AND status::text = 'completed' AND "completedAt" >= date_trunc('week', now())`,
      [driverId],
    );
    const achieved = Math.max(0, (g[0]?.gross ?? 0) - (c[0]?.total ?? 0));
    return {
      dailyGoal: { achievedKz: achieved, targetKz: DAILY_GOAL_KZ },
      challenges: [
        { id: 'daily-5', title: 'Dia ativo', description: 'Completa 5 corridas hoje.', rewardKz: 0, progressCount: Math.min(g[0]?.n ?? 0, 5), targetCount: 5, expiresInDays: 0 },
        { id: 'week-15', title: 'Desafio da semana', description: 'Completa 15 corridas esta semana.', rewardKz: 0, progressCount: Math.min(w[0]?.n ?? 0, 15), targetCount: 15, expiresInDays: Math.max(0, (w[0]?.left ?? 1) - 1) },
      ],
    };
  }

﻿  // ---------- Avaliacoes recebidas (sem nome do passageiro) ----------
  async ratings(driverId: string) {
    const s = await this.db.query(
      `SELECT COUNT(*)::int AS n, COALESCE(AVG(stars),0)::float AS avg FROM ratings WHERE "driverId" = $1`,
      [driverId],
    );
    const d = await this.db.query(
      `SELECT stars, COUNT(*)::int AS n FROM ratings WHERE "driverId" = $1 GROUP BY stars`,
      [driverId],
    );
    const recent = await this.db.query(
      `SELECT stars, comment, "createdAt" FROM ratings WHERE "driverId" = $1 ORDER BY "createdAt" DESC LIMIT 30`,
      [driverId],
    );
    return {
      count: s[0]?.n ?? 0,
      average: Math.round((s[0]?.avg ?? 0) * 100) / 100,
      distribution: [5, 4, 3, 2, 1].map((st) => ({ stars: st, count: d.find((x: any) => Number(x.stars) === st)?.n ?? 0 })),
      recent: recent.map((r: any) => ({ stars: Number(r.stars), comment: r.comment || '', createdAt: r.createdAt })),
    };
  }

  // ---------- Suporte (casos reais, visiveis no painel) ----------
  async supportList(driverId: string) {
    return this.db.query(
      `SELECT id, "caseNumber", category, description, status, "createdAt" FROM incidents
       WHERE "userId" = $1 AND "reporterType" = 'driver' AND kind = 'incident' AND category LIKE 'Suporte - %'
       ORDER BY "createdAt" DESC LIMIT 50`,
      [driverId],
    );
  }

  async supportCreate(driverId: string, body: { subject?: string; description?: string }) {
    const subjects = ['Pagamentos', 'Carteira', 'Conta e documentos', 'Corrida', 'Outro'];
    const subject = String(body?.subject ?? '');
    const description = String(body?.description ?? '').trim();
    if (!subjects.includes(subject)) throw new BadRequestException('Assunto invalido.');
    if (description.length < 10 || description.length > 1000) throw new BadRequestException('A descricao deve ter entre 10 e 1000 caracteres.');
    const year = new Date().getFullYear();
    for (let i = 0; i < 6; i++) {
      const caseNumber = `AT-${year}-${Math.floor(100000 + Math.random() * 900000)}`;
      try {
        await this.db.query(
          `INSERT INTO incidents ("caseNumber","userId",kind,category,description,status,severity,"isLiveShare","reporterType")
           VALUES ($1,$2,'incident',$3,$4,'recebido','normal',false,'driver')`,
          [caseNumber, driverId, 'Suporte - ' + subject, description],
        );
        return { caseNumber };
      } catch (e: any) {
        if (e?.code !== '23505') throw e;
      }
    }
    throw new BadRequestException('Nao foi possivel registar. Tenta outra vez.');
  }

  // ---------- Perfil turismo ----------
  private async tourismRow(driverId: string) {
    await this.db.query(`INSERT INTO driver_tourism ("driverId") VALUES ($1) ON CONFLICT DO NOTHING`, [driverId]);
    const r = await this.db.query(`SELECT languages, "trainingCompleted", active FROM driver_tourism WHERE "driverId" = $1`, [driverId]);
    const d = await this.db.query(`SELECT rating FROM drivers WHERE id = $1`, [driverId]);
    const languages = String(r[0].languages || '').split(',').filter(Boolean);
    const currentRating = Number(d[0]?.rating ?? 0);
    const hasTrainingCompleted = !!r[0].trainingCompleted;
    const eligible = hasTrainingCompleted && languages.length >= MIN_TOURISM_LANGUAGES && currentRating >= MIN_TOURISM_RATING;
    return { hasTrainingCompleted, languages, minimumRating: MIN_TOURISM_RATING, currentRating, isEligible: eligible, isActive: !!r[0].active && eligible, availableLanguages: LANGUAGES };
  }

  tourism(driverId: string) { return this.tourismRow(driverId); }

  async setTourismLanguages(driverId: string, body: { languages?: string[] }) {
    const list = Array.isArray(body?.languages) ? body.languages.filter((l) => LANGUAGES.includes(l)) : [];
    await this.tourismRow(driverId);
    await this.db.query(`UPDATE driver_tourism SET languages = $2, "updatedAt" = now() WHERE "driverId" = $1`, [driverId, [...new Set(list)].join(',')]);
    return this.tourismRow(driverId);
  }

  async setTourismActive(driverId: string, body: { active?: boolean }) {
    const t = await this.tourismRow(driverId);
    if (body?.active && !t.isEligible) throw new ForbiddenException('Ainda nao cumpres todos os requisitos do Perfil Turismo.');
    await this.db.query(`UPDATE driver_tourism SET active = $2, "updatedAt" = now() WHERE "driverId" = $1`, [driverId, !!body?.active]);
    return this.tourismRow(driverId);
  }
}