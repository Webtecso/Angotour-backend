import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AdminOpsService } from './admin-ops.service';
import { AdminAuditService } from '../admin-auth/admin-audit.service';
import { Roles } from '../admin-auth/roles.decorator';
import { RolesGuard } from '../admin-auth/roles.guard';
import { DriverDocumentsService } from '../driver-documents/driver-documents.service';
import { RejectDocumentDto } from '../driver-documents/dto/reject-document.dto';

/** Rotas do painel. Login de admin (admin-jwt) + papel (RolesGuard). O super_admin passa sempre. */
@Controller('admin')
@UseGuards(AuthGuard('admin-jwt'), RolesGuard)
export class AdminOpsController {
  constructor(
    private readonly ops: AdminOpsService,
    private readonly docs: DriverDocumentsService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.ops.dashboard();
  }

  @Get('drivers')
  @Roles('operations', 'support', 'finance')
  drivers(@Query('status') status?: string, @Query('verified') verified?: string, @Query('q') q?: string) {
    return this.ops.drivers({ status, verified, q });
  }

  @Get('drivers/:id')
  @Roles('operations', 'support', 'finance')
  driver(@Param('id', ParseUUIDPipe) id: string) {
    return this.ops.driverDetail(id);
  }

  @Get('map/drivers')
  @Roles('operations', 'safety')
  mapDrivers(@Query('status') status?: string) {
    return this.ops.mapDrivers(status);
  }

  @Get('incidents')
  @Roles('safety', 'support')
  incidents(@Query('kind') kind?: string, @Query('status') status?: string) {
    return this.ops.incidents({ kind, status });
  }

  @Patch('incidents/:id/status')
  @Roles('safety', 'support')
  async updateIncidentStatus(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body('status') status: string) {
    const info = await this.ops.incidentInfo(id);
    const result = await this.ops.updateIncidentStatus(id, status);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'incident_status_updated',
      targetType: 'incident', targetId: id, details: { caseNumber: info.caseNumber, kind: info.kind, status },
    });
    return result;
  }

  @Get('passengers')
  @Roles('operations', 'support')
  passengers(@Query('q') q?: string) {
    return this.ops.passengers({ q });
  }

  @Get('passengers/:id')
  @Roles('operations', 'support')
  passengerDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.ops.passengerDetail(id);
  }

  @Get('vehicles')
  @Roles('operations')
  vehicles(@Query('q') q?: string) {
    return this.ops.vehicles({ q });
  }

  @Patch('vehicles/:id/approve')
  @Roles('operations')
  async approveVehicle(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const info = await this.ops.vehicleInfo(id);
    const result = await this.ops.approveVehicle(id);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'vehicle_approved',
      targetType: 'vehicle', targetId: id, details: { plate: info.plate, driverId: info.driverId },
    });
    return result;
  }

  @Patch('vehicles/:id/reject')
  @Roles('operations')
  async rejectVehicle(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body('reason') reason: string) {
    const info = await this.ops.vehicleInfo(id);
    const result = await this.ops.rejectVehicle(id, reason);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'vehicle_rejected',
      targetType: 'vehicle', targetId: id, details: { plate: info.plate, driverId: info.driverId, reason },
    });
    return result;
  }

  @Get('finance/overview')
  @Roles('finance', 'operations')
  financeOverview() {
    return this.ops.financeOverview();
  }

  @Get('finance/wallets')
  @Roles('finance', 'operations')
  wallets(@Query('q') q?: string) {
    return this.ops.wallets({ q });
  }

  @Get('finance/wallets/:id')
  @Roles('finance', 'operations')
  walletDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.ops.walletDetail(id);
  }

  @Get('agents')
  @Roles('operations')
  agents(@Query('q') q?: string) {
    return this.ops.agents({ q });
  }

  @Post('agents')
  @Roles('operations')
  async createAgent(@Req() req: any, @Body() dto: { fullName: string; phone: string; email?: string; commissionPercent?: number }) {
    const result = await this.ops.createAgent(dto);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'agent_created',
      targetType: 'agent', targetId: result.id, details: { fullName: dto.fullName, referralCode: result.referralCode },
    });
    return result;
  }

  @Get('agents/:id')
  @Roles('operations')
  agentDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.ops.agentDetail(id);
  }

  @Patch('agents/:id/drivers/:driverId')
  @Roles('operations')
  async assignDriverToAgent(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Param('driverId', ParseUUIDPipe) driverId: string) {
    const result = await this.ops.assignDriverToAgent(id, driverId);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'agent_driver_assigned',
      targetType: 'agent', targetId: id, details: { driverId, driverName: result.driverName },
    });
    return result;
  }

  @Delete('agents/:id/drivers/:driverId')
  @Roles('operations')
  async unassignDriverFromAgent(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Param('driverId', ParseUUIDPipe) driverId: string) {
    const result = await this.ops.unassignDriverFromAgent(id, driverId);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'agent_driver_unassigned',
      targetType: 'agent', targetId: id, details: { driverId },
    });
    return result;
  }

  @Get('owners')
  @Roles('operations')
  owners(@Query('q') q?: string) {
    return this.ops.owners({ q });
  }

  @Post('owners')
  @Roles('operations')
  async createOwner(@Req() req: any, @Body() dto: { fullName: string; phone: string; email?: string }) {
    const result = await this.ops.createOwner(dto);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'owner_created',
      targetType: 'owner', targetId: result.id, details: { fullName: dto.fullName },
    });
    return result;
  }

  @Get('owners/:id')
  @Roles('operations')
  ownerDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.ops.ownerDetail(id);
  }

  @Get('fleets')
  @Roles('operations')
  fleets(@Query('q') q?: string) {
    return this.ops.fleets({ q });
  }

  @Post('fleets')
  @Roles('operations')
  async createFleet(@Req() req: any, @Body() dto: { ownerId: string; name: string }) {
    const result = await this.ops.createFleet(dto);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'fleet_created',
      targetType: 'fleet', targetId: result.id, details: { ownerId: dto.ownerId, name: dto.name },
    });
    return result;
  }

  @Get('fleets/:id')
  @Roles('operations')
  fleetDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.ops.fleetDetail(id);
  }

  @Patch('fleets/:id/vehicles/:vehicleId')
  @Roles('operations')
  async assignVehicleToFleet(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Param('vehicleId', ParseUUIDPipe) vehicleId: string) {
    const result = await this.ops.assignVehicleToFleet(id, vehicleId);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'fleet_vehicle_assigned',
      targetType: 'fleet', targetId: id, details: { vehicleId, plate: result.plate },
    });
    return result;
  }

  @Delete('fleets/:id/vehicles/:vehicleId')
  @Roles('operations')
  async unassignVehicleFromFleet(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Param('vehicleId', ParseUUIDPipe) vehicleId: string) {
    const result = await this.ops.unassignVehicleFromFleet(id, vehicleId);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'fleet_vehicle_unassigned',
      targetType: 'fleet', targetId: id, details: { vehicleId },
    });
    return result;
  }

  @Get('trips')
  @Roles('operations', 'support')
  trips(@Query('status') status?: string) {
    return this.ops.trips(status);
  }

  @Get('documents')
  @Roles('operations')
  documents(@Query('status') status?: string) {
    return this.ops.documents(status);
  }

  // Documentos de identidade: ver a imagem tambem fica na auditoria.
  @Get('documents/:id/file')
  @Roles('operations')
  async file(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { filePath, mimeType } = await this.docs.getFile(id);
    const info = await this.ops.documentInfo(id);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'document_viewed',
      targetType: 'driver_document', targetId: id, details: { driverId: info.driverId, type: info.type },
    });
    res.type(mimeType);
    res.sendFile(filePath);
  }

  @Patch('documents/:id/approve')
  @Roles('operations')
  async approve(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const info = await this.ops.documentInfo(id);
    const result = await this.docs.approve(id);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'document_approved',
      targetType: 'driver_document', targetId: id, details: { driverId: info.driverId, type: info.type, allApproved: result.allApproved },
    });
    return result;
  }

  @Patch('documents/:id/reject')
  @Roles('operations')
  async reject(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectDocumentDto) {
    const info = await this.ops.documentInfo(id);
    const result = await this.docs.reject(id, dto.reason);
    await this.audit.record({
      adminId: req.user.adminId, adminEmail: req.user.email, action: 'document_rejected',
      targetType: 'driver_document', targetId: id, details: { driverId: info.driverId, type: info.type, reason: dto.reason },
    });
    return result;
  }
}







