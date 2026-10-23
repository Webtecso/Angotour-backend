import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DriverDocumentsService } from './driver-documents.service';
import { SubmitDocumentDto } from './dto/submit-document.dto';

/** O id do motorista vem sempre do token (driver-jwt), nunca do cliente. */
@Controller('driver/documents')
@UseGuards(AuthGuard('driver-jwt'))
export class DriverDocumentsController {
  constructor(private readonly service: DriverDocumentsService) {}

  @Get()
  list(@Req() req: any) {
    return this.service.list(req.user.driverId);
  }

  @Post(':type')
  submit(@Req() req: any, @Param('type') type: string, @Body() dto: SubmitDocumentDto) {
    return this.service.submit(req.user.driverId, type, dto.imageBase64);
  }
}
