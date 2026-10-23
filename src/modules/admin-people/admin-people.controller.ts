import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminPeopleService } from './admin-people.service';
import { AdminAuditService } from '../admin-auth/admin-audit.service';
import { Roles } from '../admin-auth/roles.decorator';
import { RolesGuard } from '../admin-auth/roles.guard';
import { RejectDocumentDto } from '../driver-documents/dto/reject-document.dto';

/** Passageiros e veiculos no painel. Login de admin (admin-jwt) + papel. O super_admin passa sempre. */
@Controller('admin')
@UseGuards(AuthGuard('admin-jwt'), RolesGuard)
export class AdminPeopleController {
  constructor(
    private readonly people: AdminPeopleService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get('passengers')
  @Roles('operations', 'support')
  passengers(@Query('q') q?: string) {
    return this.people.passengers(q);
  }

  @Get('passengers/:id')
  @Roles('operations', 'support')
  passenger(@Param('id', ParseUUIDPipe) id: string) {
    return this.people.passengerDetail(id);
  }

  @Get('vehicles')
  @Roles('operations')
  vehicles(@Query('q') q?: string) {
    return this.people.vehicles(q);
  }

  @Patch('vehicles/:id/approve')
  @Roles('operations')
  async approveVehicle(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const v = await this.people.approveVehicle(id);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'vehicle_approved',
      targetType: 'vehicle', targetId: id, details: { driverId: v.driverId, plate: v.plate },
    });
    return { id, status: 'approved' };
  }

  @Patch('vehicles/:id/reject')
  @Roles('operations')
  async rejectVehicle(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectDocumentDto) {
    const v = await this.people.rejectVehicle(id, dto.reason);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'vehicle_rejected',
      targetType: 'vehicle', targetId: id, details: { driverId: v.driverId, plate: v.plate, reason: dto.reason },
    });
    return { id, status: 'rejected' };
  }
}
