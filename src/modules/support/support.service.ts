import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    });
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
