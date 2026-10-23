import { ExtrasModule } from './modules/extras/extras.module';
import { ProfileModule } from './modules/profile/profile.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { SupportModule } from './modules/support/support.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { TripsModule } from './modules/trips/trips.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { DriverAuthModule } from './modules/driver-auth/driver-auth.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { AdminOpsModule } from './modules/admin-ops/admin-ops.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { AdminPeopleModule } from './modules/admin-people/admin-people.module';
import { PartnersModule } from './modules/partners/partners.module';
import { AdminFinanceModule } from './modules/admin-finance/admin-finance.module';
import { DriverWalletModule } from './modules/driver-wallet/driver-wallet.module';
import { DriverVehicleModule } from './modules/driver-vehicle/driver-vehicle.module';
import { DriverDocumentsModule } from './modules/driver-documents/driver-documents.module';

@Module({
  imports: [
    ExtrasModule,
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ useFactory: databaseConfig }),
    UsersModule,
    AuthModule,
    DriversModule,
    TripsModule,
    SupportModule,
    ProfileModule,
    WalletModule,
    TrackingModule,
    VehiclesModule,
    DriverAuthModule,
    AdminAuthModule,
    AdminOpsModule,
    PricingModule,
    AdminPeopleModule,
    PartnersModule,
    AdminFinanceModule,
    DriverWalletModule,
    DriverVehicleModule,
    DriverDocumentsModule,
  ],
})
export class AppModule {}
