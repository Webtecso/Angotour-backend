import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { randomInt, timingSafeEqual } from 'crypto';
import { sendSms } from './sms.sender';

interface OtpRecord {
  code: string;
  issuedAt: number;
  expiresAt: number;
  attempts: number;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * OTP em memoria (uma instancia por modulo: passageiro e motorista isolados).
 * Em producao com varias instancias do backend, isto deve passar para Redis.
 */
@Injectable()
export class OtpService {
  private readonly otpStore = new Map<string, OtpRecord>();
  private readonly requestLog = new Map<string, number[]>();
  private readonly lockedUntil = new Map<string, number>();

  private readonly OTP_TTL_MS = 5 * 60 * 1000;
  private readonly RESEND_COOLDOWN_MS = 30 * 1000;
  private readonly MAX_REQUESTS_PER_HOUR = 5;
  private readonly MAX_VERIFY_ATTEMPTS = 5;
  private readonly LOCK_MS = 15 * 60 * 1000;

  generateAndStore(phone: string): string {
    const now = Date.now();
    this.sweep(now);
    this.assertNotLocked(phone, now);

    // Pedido repetido dentro do intervalo: reutiliza o codigo, sem novo SMS.
    const current = this.otpStore.get(phone);
    if (current && now - current.issuedAt < this.RESEND_COOLDOWN_MS) {
      return current.code;
    }

    const recent = (this.requestLog.get(phone) ?? []).filter((t) => now - t < HOUR_MS);
    if (recent.length >= this.MAX_REQUESTS_PER_HOUR) {
      throw new HttpException('Demasiados pedidos de codigo. Tenta novamente mais tarde.', HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    this.requestLog.set(phone, recent);

    const code = randomInt(100000, 1000000).toString();
    this.otpStore.set(phone, { code, issuedAt: now, expiresAt: now + this.OTP_TTL_MS, attempts: 0 });

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`[OTP] Codigo para ${phone}: ${code}`);
    }
    sendSms(phone, `AngoTour: o teu codigo e ${code}. Valido por 5 minutos.`).catch((e: Error) => {
      // eslint-disable-next-line no-console
      console.error('[SMS] falha ao enviar:', e.message);
    });

    return code;
  }

  verify(phone: string, code: string): boolean {
    const now = Date.now();
    this.assertNotLocked(phone, now);

    const record = this.otpStore.get(phone);
    if (!record) return false;
    if (now > record.expiresAt) {
      this.otpStore.delete(phone);
      return false;
    }

    if (this.safeEqual(record.code, code)) {
      this.otpStore.delete(phone);
      return true;
    }

    record.attempts += 1;
    if (record.attempts >= this.MAX_VERIFY_ATTEMPTS) {
      this.otpStore.delete(phone);
      this.lockedUntil.set(phone, now + this.LOCK_MS);
    }
    return false;
  }

  private assertNotLocked(phone: string, now: number): void {
    const until = this.lockedUntil.get(phone);
    if (until && until > now) {
      const minutes = Math.ceil((until - now) / 60000);
      throw new HttpException(`Demasiadas tentativas. Tenta novamente dentro de ${minutes} min.`, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(String(b));
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  }

  private sweep(now: number): void {
    for (const [phone, rec] of this.otpStore) {
      if (now > rec.expiresAt) this.otpStore.delete(phone);
    }
    for (const [phone, until] of this.lockedUntil) {
      if (until <= now) this.lockedUntil.delete(phone);
    }
    for (const [phone, list] of this.requestLog) {
      const kept = list.filter((t) => now - t < HOUR_MS);
      if (kept.length === 0) this.requestLog.delete(phone);
      else this.requestLog.set(phone, kept);
    }
  }
}
