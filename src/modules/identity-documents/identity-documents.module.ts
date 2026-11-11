import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserDocument } from './entities/user-document.entity';
import { IdentityDocumentsService } from './identity-documents.service';
import { IdentityDocumentsController } from './identity-documents.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserDocument])],
  controllers: [IdentityDocumentsController],
  providers: [IdentityDocumentsService],
  exports: [IdentityDocumentsService],
})
export class IdentityDocumentsModule {}