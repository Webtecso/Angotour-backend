import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

/**
 * Envio de notificacoes push via Expo. Best-effort sempre: nunca lanca erro
 * para quem chama - uma falha aqui nao pode derrubar uma viagem ou mensagem.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');
  private readonly expo = new Expo();

  constructor(private readonly db: DataSource) {}

  async sendToDriver(driverId: string, title: string, body: string, data?: Record<string, unknown>) {
    try {
      const rows: Array<{ pushToken: string | null }> = await this.db.query(
        `SELECT "pushToken" FROM drivers WHERE id = $1`,
        [driverId],
      );
      await this.deliver(rows[0]?.pushToken ?? null, title, body, data);
    } catch (e) {
      this.logger.warn(`Falha ao notificar motorista ${driverId}: ${(e as Error).message}`);
    }
  }

  async sendToUser(userId: string, title: string, body: string, data?: Record<string, unknown>) {
    try {
      const rows: Array<{ pushToken: string | null }> = await this.db.query(
        `SELECT "pushToken" FROM user_profiles WHERE "userId" = $1`,
        [userId],
      );
      await this.deliver(rows[0]?.pushToken ?? null, title, body, data);
    } catch (e) {
      this.logger.warn(`Falha ao notificar utilizador ${userId}: ${(e as Error).message}`);
    }
  }

  async sendToTripPassenger(tripId: string, title: string, body: string, data?: Record<string, unknown>) {
    try {
      const rows: Array<{ passengerId: string | null }> = await this.db.query(
        `SELECT "passengerId" FROM trips WHERE id = $1`,
        [tripId],
      );
      const passengerId = rows[0]?.passengerId;
      if (!passengerId) return;
      await this.sendToUser(passengerId, title, body, data);
    } catch (e) {
      this.logger.warn(`Falha ao notificar passageiro da viagem ${tripId}: ${(e as Error).message}`);
    }
  }

  private async deliver(pushToken: string | null, title: string, body: string, data?: Record<string, unknown>) {
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;
    const message: ExpoPushMessage = { to: pushToken, sound: 'default', title, body, data: data ?? {} };
    try {
      const tickets = await this.expo.sendPushNotificationsAsync([message]);
      if (tickets[0]?.status === 'error') {
        this.logger.warn(`Push rejeitado: ${tickets[0].message}`);
      }
    } catch (e) {
      this.logger.warn(`Falha ao enviar push: ${(e as Error).message}`);
    }
  }
}