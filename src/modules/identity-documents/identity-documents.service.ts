import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { REQUIRED_IDENTITY_DOCUMENTS, UserDocument } from './entities/user-document.entity';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'identity-docs');
const MAX_BYTES = 8 * 1024 * 1024;

// O tipo do ficheiro e decidido pelos primeiros bytes, nunca pelo que o cliente diz.
function detectImage(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: 'png', mime: 'image/png' };
  return null;
}

@Injectable()
export class IdentityDocumentsService {
  constructor(
    @InjectRepository(UserDocument)
    private readonly repo: Repository<UserDocument>,
  ) {}

  // ---------- lado do passageiro ----------

  async list(userId: string) {
    const docs = await this.repo.find({ where: { userId } });
    return REQUIRED_IDENTITY_DOCUMENTS.map((type) => {
      const d = docs.find((x) => x.type === type);
      return {
        type,
        status: d ? d.status : 'not_submitted',
        rejectionReason: d?.rejectionReason ?? null,
        updatedAt: d?.updatedAt ?? null,
      };
    });
  }

  async submit(userId: string, type: string, imageBase64: string) {
    if (!(REQUIRED_IDENTITY_DOCUMENTS as readonly string[]).includes(type)) {
      throw new BadRequestException('Tipo de documento invalido.');
    }
    const clean = imageBase64.replace(/^data:[^;]+;base64,/, '');
    const buf = Buffer.from(clean, 'base64');
    if (buf.length === 0 || buf.length > MAX_BYTES) {
      throw new BadRequestException('Imagem invalida ou maior que 8 MB.');
    }
    const kind = detectImage(buf);
    if (!kind) throw new BadRequestException('Formato invalido. Envia uma imagem JPEG ou PNG.');

    const existing = await this.repo.findOne({ where: { userId, type } });
    if (existing?.status === 'approved') {
      throw new BadRequestException('Este documento ja foi aprovado.');
    }

    const dir = path.join(UPLOAD_ROOT, userId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${type}-${randomUUID()}.${kind.ext}`);
    await fs.writeFile(filePath, buf);
    if (existing?.filePath) await fs.unlink(existing.filePath).catch(() => undefined);

    const doc = existing ?? this.repo.create({ userId, type });
    doc.status = 'pending';
    doc.filePath = filePath;
    doc.mimeType = kind.mime;
    doc.rejectionReason = null;
    doc.reviewedAt = null;
    await this.repo.save(doc);
    return { type, status: doc.status, rejectionReason: null, updatedAt: doc.updatedAt };
  }

  async areAllApproved(userId: string): Promise<boolean> {
    const docs = await this.repo.find({ where: { userId, status: 'approved' } });
    const approved = new Set(docs.map((d) => d.type));
    return REQUIRED_IDENTITY_DOCUMENTS.every((t) => approved.has(t));
  }

  // ---------- revisao (admin, mesmo guard do painel) ----------

  listForReview(status?: string) {
    const s = status === 'all' ? null : status && ['pending', 'approved', 'rejected'].includes(status) ? status : 'pending';
    return this.repo.query(
      `SELECT d.id, d."userId", d.type, d.status, d."rejectionReason", d."createdAt", d."updatedAt", u."fullName", u.phone
       FROM user_documents d JOIN users u ON u.id = d."userId"
       WHERE ($1::text IS NULL OR d.status = $1)
       ORDER BY d."updatedAt" ASC LIMIT 300`,
      [s],
    );
  }

  async info(id: string): Promise<{ userId: string; type: string }> {
    const doc = await this.repo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Documento nao encontrado.');
    return { userId: doc.userId, type: doc.type };
  }

  async getFile(id: string): Promise<{ filePath: string; mimeType: string }> {
    const doc = await this.repo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Documento nao encontrado.');
    const resolved = path.resolve(doc.filePath);
    if (!resolved.startsWith(UPLOAD_ROOT + path.sep)) throw new ForbiddenException();
    return { filePath: resolved, mimeType: doc.mimeType };
  }

  async approve(id: string) {
    const doc = await this.repo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Documento nao encontrado.');
    doc.status = 'approved';
    doc.rejectionReason = null;
    doc.reviewedAt = new Date();
    await this.repo.save(doc);

    // Com os 3 aprovados, o passageiro passa a "verificado".
    const allApproved = await this.areAllApproved(doc.userId);
    if (allApproved) {
      await this.repo.query(
        `UPDATE user_profiles SET "isVerified" = true, "verificationStatus" = 'verified', "verifiedAt" = now() WHERE "userId" = $1`,
        [doc.userId],
      );
    }
    return { id: doc.id, type: doc.type, status: doc.status, allApproved };
  }

  async reject(id: string, reason: string) {
    const doc = await this.repo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Documento nao encontrado.');
    doc.status = 'rejected';
    doc.rejectionReason = reason;
    doc.reviewedAt = new Date();
    await this.repo.save(doc);
    await this.repo.query(
      `UPDATE user_profiles SET "isVerified" = false, "verificationStatus" = 'rejected' WHERE "userId" = $1`,
      [doc.userId],
    );
    return { id: doc.id, type: doc.type, status: doc.status };
  }
}
