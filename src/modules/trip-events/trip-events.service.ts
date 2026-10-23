import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TripEvent } from './entities/trip-event.entity';
import { CreateTripEventDto } from './dto/create-trip-event.dto';

@Injectable()
export class TripEventsService {
  constructor(
    @InjectRepository(TripEvent)
    private readonly repo: Repository<TripEvent>,
  ) {}

  create(userId: string, dto: CreateTripEventDto): Promise<TripEvent> {
    return this.repo.save(
      this.repo.create({
        userId,
        tripRef: dto.tripRef,
        type: dto.type,
        meta: dto.meta,
        clientAt: dto.clientAt ? new Date(dto.clientAt) : undefined,
      }),
    );
  }

  findByTrip(userId: string, tripRef: string): Promise<TripEvent[]> {
    return this.repo.find({ where: { userId, tripRef }, order: { createdAt: 'ASC' } });
  }
}
