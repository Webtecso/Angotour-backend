import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverDocument } from './entities/driver-document.entity';
import { DriverDocumentsService } from './driver-documents.service';
import { DriverDocumentsController } from './driver-documents.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DriverDocument])],
  controllers: [DriverDocumentsController],
  providers: [DriverDocumentsService],
  exports: [DriverDocumentsService],
})
export class DriverDocumentsModule {}
