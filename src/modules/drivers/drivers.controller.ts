import { Body, Controller, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DataSource } from 'typeorm';
import { DriversService } from './drivers.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { DriverStatus } from './entities/driver.entity';
import { DriverWalletService } from '../driver-wallet/driver-wallet.service';
import { DriverDocumentsService } from '../driver-documents/driver-documents.service';
import { assertVehicleApproved } from '../../common/vehicle-approval';

@Controller('drivers')
export class DriversController {
  constructor(
    private readonly driversService: DriversService,
    private readonly driverWallet: DriverWalletService,
    private readonly driverDocs: DriverDocumentsService,
    private readonly db: DataSource,
  ) {}

  // Protegido por driver-jwt: so o proprio motorista (via req.user.driverId
  // do token) pode mexer na sua localizacao - nunca um id vindo do cliente.
  @Patch('me/location')
  @UseGuards(AuthGuard('driver-jwt'))
  updateMyLocation(@Req() req: any, @Body() dto: UpdateLocationDto) {
    return this.driversService.updateLocation(req.user.driverId, dto);
  }

  // Para receber corridas: documentos aprovados, veiculo aprovado e saldo
  // operacional (minimo 2.000 Kz). Falhar qualquer um impede de ficar online.
  @Patch('me/status')
  @UseGuards(AuthGuard('driver-jwt'))
  async setMyStatus(@Req() req: any, @Body('status') status: DriverStatus) {
    if (status === DriverStatus.ONLINE) {
      await this.driverDocs.assertAllApproved(req.user.driverId);
      await assertVehicleApproved(this.db, req.user.driverId);
      await this.driverWallet.assertCanGoOnline(req.user.driverId);
    }
    return this.driversService.setStatus(req.user.driverId, status);
  }

  // Chamado pelo app do passageiro (JWT de passageiro) para ver carros por perto.
  @Post('nearby')
  @UseGuards(AuthGuard('jwt'))
  findNearby(@Query('lat') lat: string, @Query('lng') lng: string, @Query('radiusKm') radiusKm?: string) {
    return this.driversService.findNearby(
      { latitude: Number(lat), longitude: Number(lng) },
      radiusKm ? Number(radiusKm) : undefined,
    );
  }
}
