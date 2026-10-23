import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { DriverDocument, REQUIRED_DRIVER_DOCUMENTS } from './entities/driver-document.entity';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'driver-docs');
const MAX_BYTES = 8 * 1024 * 1024;

// O tipo do ficheiro e decidido pelos primeiros bytes, nunca pelo que o cliente diz.
function detectImage(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: 'png', mime: 'image/png' };
  return null;
}

@Injectable()
export class DriverDocumentsService {
  constructor(
    @InjectRepository(DriverDocument)
    private readonly repo: Repository<DriverDocument>,
  ) {}

  // ---------- lado do motorista ----------

  /** Estado de cada documento obrigatorio (os que nunca foram enviados aparecem como not_submitted). */
  async list(driverId: string) {
    const docs = await this.repo.find({ where: { driverId } });
    return REQUIRED_DRIVER_DOCUMENTS.map((type) => {
      const d = docs.find((x) => x.type === type);
      return {
        type,
        status: d ? d.status : 'not_submitted',
        rejectionReason: d?.rejectionReason ?? null,
        updatedAt: d?.updatedAt ?? null,
      };
    });
  }

  async submit(driverId: string, type: string, imageBase64: string) {
    if (!(REQUIRED_DRIVER_DOCUMENTS as readonly string[]).includes(type)) {
      throw new BadRequestException('Tipo de documento invalido.');
    }
    const clean = imageBase64.replace(/^data:[^;]+;base64,/, '');
    const buf = Buffer.from(clean, 'base64');
    if (buf.length === 0 || buf.length > MAX_BYTES) {
      throw new BadRequestException('Imagem invalida ou maior que 8 MB.');
    }
    const kind = detectImage(buf);
    if (!kind) throw new BadRequestException('Formato invalido. Envia uma imagem JPEG ou PNG.');

    const existing = await this.repo.findOne({ where: { driverId, type } });
    if (existing?.status === 'approved') {
      throw new BadRequestException('Este documento ja foi aprovado.');
    }

    const dir = path.join(UPLOAD_ROOT, driverId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${type}-${randomUUID()}.${kind.ext}`);
    await fs.writeFile(filePath, buf);
    if (existing?.filePath) await fs.unlink(existing.filePath).catch(() => undefined);

    const doc = existing ?? this.repo.create({ driverId, type });
    doc.status = 'pending';
    doc.filePath = filePath;
    doc.mimeType = kind.mime;
    doc.rejectionReason = null;
    doc.reviewedAt = null;
    await this.repo.save(doc);
    return { type, status: doc.status, rejectionReason: null, updatedAt: doc.updatedAt };
  }

  async areAllApproved(driverId: string): Promise<boolean> {
    const docs = await this.repo.find({ where: { driverId, status: 'approved' } });
    const approved = new Set(docs.map((d) => d.type));
    return REQUIRED_DRIVER_DOCUMENTS.every((t) => approved.has(t));
  }

  async assertAllApproved(driverId: string): Promise<void> {
    if (!(await this.areAllApproved(driverId))) {
      throw new ForbiddenException(
        'Documentos pendentes. Todos os documentos obrigatorios tem de estar aprovados para receberes corridas.',
      );
    }
  }

  // ---------- revisao (so com a chave de administrador) ----------

  listPending() {
    return this.repo.query(
      `SELECT d.id, d."driverId", d.type, d."createdAt", dr."fullName", dr.phone
       FROM driver_documents d JOIN drivers dr ON dr.id = d."driverId"
       WHERE d.status = 'pending' ORDER BY d."createdAt" ASC`,
    );
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

    // Com os 6 aprovados, o motorista passa a "verificado".
    const allApproved = await this.areAllApproved(doc.driverId);
    if (allApproved) {
      await this.repo.query(`UPDATE drivers SET "isVerified" = true WHERE id = $1`, [doc.driverId]);
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
    await this.repo.query(`UPDATE drivers SET "isVerified" = false WHERE id = $1`, [doc.driverId]);
    return { id: doc.id, type: doc.type, status: doc.status };
  }
}
