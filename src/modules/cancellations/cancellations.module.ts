import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cancellation } from './entities/cancellation.entity';
import { CancellationsService } from './cancellations.service';
import { CancellationsController } from './cancellations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cancellation])],
  controllers: [CancellationsController],
  providers: [CancellationsService],
  exports: [CancellationsService],
})
export class CancellationsModule {}
