import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Incident } from './entities/incident.entity';
import { CreateIncidentDto } from './dto/create-incident.dto';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(Incident)
    private readonly incidentsRepository: Repository<Incident>,
  ) {}

  private async generateCaseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    for (let i = 0; i < 8; i++) {
      const candidate = `AT-${year}-${Math.floor(100000 + Math.random() * 900000)}`;
      const exists = await this.incidentsRepository.exist({ where: { caseNumber: candidate } });
      if (!exists) return candidate;
    }
    return `AT-${year}-${Date.now().toString().slice(-8)}`;
  }

  async create(userId: string, dto: CreateIncidentDto): Promise<Incident> {
    const incident = this.incidentsRepository.create({
      caseNumber: await this.generateCaseNumber(),
      userId,
      kind: dto.kind,
      category: dto.category,
      description: dto.description ?? '',
      tripRef: dto.tripRef,
      status: 'recebido',
      severity: dto.kind === 'sos' ? 'critico' : 'normal',
    });
    return this.incidentsRepository.save(incident);
  }

  /** Alerta de seguranca enviado pelo motorista. Guarda o id do motorista em userId e marca a origem. */
  async createDriverAlert(
    driverId: string,
    dto: { category: string; tripRef?: string; latitude?: number; longitude?: number; description?: string },
  ): Promise<Incident> {
    // Toques repetidos no botao nao criam casos duplicados.
    const recent = await this.incidentsRepository.findOne({
      where: { userId: driverId, reporterType: 'driver', category: dto.category, createdAt: MoreThan(new Date(Date.now() - 60000)) },
      order: { createdAt: 'DESC' },
    });
    if (recent) return recent;

    const critical = ['Emergencia', 'Policia', 'Acidente'].includes(dto.category);
    const hasPosition = typeof dto.latitude === 'number' && typeof dto.longitude === 'number';
    const incident = this.incidentsRepository.create({
      caseNumber: await this.generateCaseNumber(),
      userId: driverId,
      reporterType: 'driver',
      kind: critical ? 'sos' : 'incident',
      category: dto.category,
      description: dto.description ?? '',
      tripRef: dto.tripRef,
      status: 'recebido',
      severity: critical ? 'critico' : 'elevado',
      isLiveShare: false, // posicao unica, sem seguimento continuo
      liveLocationLat: hasPosition ? dto.latitude : undefined,
      liveLocationLng: hasPosition ? dto.longitude : undefined,
    });
    return this.incidentsRepository.save(incident);
  }

  async updateLiveLocation(userId: string, caseNumber: string, latitude: number, longitude: number) {
    const incident = await this.findOneMine(userId, caseNumber);
    incident.isLiveShare = true;
    incident.liveLocationLat = latitude;
    incident.liveLocationLng = longitude;
    return this.incidentsRepository.save(incident);
  }

  async resolve(userId: string, caseNumber: string) {
    const incident = await this.findOneMine(userId, caseNumber);
    incident.status = 'resolvido';
    incident.isLiveShare = false;
    incident.resolvedAt = new Date();
    return this.incidentsRepository.save(incident);
  }

  findMine(userId: string): Promise<Incident[]> {
    return this.incidentsRepository.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async findOneMine(userId: string, caseNumber: string): Promise<Incident> {
    const incident = await this.incidentsRepository.findOne({ where: { userId, caseNumber } });
    if (!incident) throw new NotFoundException('Caso nao encontrado.');
    return incident;
  }
}

