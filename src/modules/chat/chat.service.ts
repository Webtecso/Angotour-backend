import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { NotificationsService } from '../notifications/notifications.service';

export type ChatRole = 'passenger' | 'driver';

export interface ChatMessageView {
  id: string;
  senderRole: ChatRole;
  body: string;
  createdAt: Date;
  fromMe: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WRITABLE = ['driver_assigned', 'driver_arriving', 'in_progress'];
const MAX_LEN = 500;
const MAX_PER_MINUTE = 20;

@Injectable()
export class ChatService implements OnModuleInit {
  private readonly logger = new Logger('Chat');

  constructor(
    private readonly db: DataSource,
    private readonly tracking: TrackingGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS trip_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tripId" uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        "driverId" uuid NOT NULL,
        "senderRole" varchar(10) NOT NULL CHECK ("senderRole" IN ('passenger','driver')),
        "senderId" uuid NOT NULL,
        body varchar(500) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await this.db.query(
      `CREATE INDEX IF NOT EXISTS trip_messages_thread_idx ON trip_messages ("tripId", "driverId", "createdAt")`,
    );
    this.logger.log('Tabela trip_messages pronta.');
  }

  private async access(tripId: string, role: ChatRole, actorId: string) {
    if (!UUID.test(tripId)) throw new NotFoundException('Conversa nao encontrada.');
    const rows: Array<{ status: string; driverId: string | null; passengerId: string | null }> = await this.db.query(
      `SELECT status::text AS status, "driverId", "passengerId" FROM trips WHERE id = $1`,
      [tripId],
    );
    const t = rows[0];
    const mine = !!t && (role === 'driver' ? t.driverId === actorId : t.passengerId === actorId);
    if (!t || !mine) throw new NotFoundException('Conversa nao encontrada.');
    return t;
  }

  async list(role: ChatRole, actorId: string, tripId: string) {
    const t = await this.access(tripId, role, actorId);
    if (!t.driverId) return { messages: [] as ChatMessageView[], canSend: false };
    const rows = await this.db.query(
      `SELECT id, "senderRole", body, "createdAt" FROM (
         SELECT id, "senderRole", body, "createdAt" FROM trip_messages
         WHERE "tripId" = $1 AND "driverId" = $2
         ORDER BY "createdAt" DESC LIMIT 200
       ) s ORDER BY "createdAt" ASC`,
      [tripId, t.driverId],
    );
    const messages: ChatMessageView[] = rows.map((r: any) => ({
      id: r.id,
      senderRole: r.senderRole,
      body: r.body,
      createdAt: r.createdAt,
      fromMe: r.senderRole === role,
    }));
    return { messages, canSend: WRITABLE.includes(t.status) };
  }

  async send(role: ChatRole, actorId: string, tripId: string, rawBody: string) {
    const body = String(rawBody ?? '').trim();
    if (!body) throw new BadRequestException('Mensagem vazia.');
    if (body.length > MAX_LEN) throw new BadRequestException('Maximo de ' + MAX_LEN + ' caracteres.');

    const t = await this.access(tripId, role, actorId);
    if (!t.driverId) throw new BadRequestException('Ainda nao ha motorista nesta viagem.');
    if (!WRITABLE.includes(t.status)) {
      throw new HttpException('A conversa esta fechada: a viagem ja terminou.', HttpStatus.FORBIDDEN);
    }

    const recent = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM trip_messages
       WHERE "tripId" = $1 AND "senderRole" = $2 AND "createdAt" > now() - interval '60 seconds'`,
      [tripId, role],
    );
    if ((recent[0]?.n ?? 0) >= MAX_PER_MINUTE) {
      throw new HttpException('Demasiadas mensagens. Aguarde um momento.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const rows = await this.db.query(
      `INSERT INTO trip_messages ("tripId", "driverId", "senderRole", "senderId", body)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, "senderRole", body, "createdAt"`,
      [tripId, t.driverId, role, actorId, body],
    );
    const m = rows[0];
    this.notify(tripId, t.driverId, m.id, role);
    const out: ChatMessageView = { id: m.id, senderRole: m.senderRole, body: m.body, createdAt: m.createdAt, fromMe: true };
    return out;
  }

  /** Aviso em tempo real SEM o texto, mais push (tambem sem o texto, so para acordar a app). */
  private notify(tripId: string, driverId: string, messageId: string, senderRole: ChatRole) {
    try {
      this.tracking.server.to('trip:' + tripId).to('driver:' + driverId).emit('chat_new', { tripId, messageId, senderRole });
    } catch {
      // o aviso em tempo real e opcional; as apps tambem consultam periodicamente
    }
    if (senderRole === 'driver') {
      this.notifications.sendToTripPassenger(tripId, 'Nova mensagem do motorista', 'Toca para ver a conversa.', { type: 'chat', tripId }).catch(() => {});
    } else {
      this.notifications.sendToDriver(driverId, 'Nova mensagem do passageiro', 'Toca para ver a conversa.', { type: 'chat', tripId }).catch(() => {});
    }
  }
}