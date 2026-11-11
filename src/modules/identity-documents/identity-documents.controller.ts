import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IdentityDocumentsService } from './identity-documents.service';
import { SubmitIdentityDocumentDto } from './dto/submit-identity-document.dto';

/** O id do passageiro vem sempre do token (jwt), nunca do cliente. */
@Controller('identity-documents')
@UseGuards(AuthGuard('jwt'))
export class IdentityDocumentsController {
  constructor(private readonly service: IdentityDocumentsService) {}

  @Get()
  list(@Req() req: any) {
    return this.service.list(req.user.userId);
  }

  @Post(':type')
  submit(@Req() req: any, @Param('type') type: string, @Body() dto: SubmitIdentityDocumentDto) {
    return this.service.submit(req.user.userId, type, dto.imageBase64);
  }
}
