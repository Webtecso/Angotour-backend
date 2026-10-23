import { TripPoint, TripStatus } from './entities/trip.entity';

/** O que o motorista pode ver de uma viagem. O codigo de embarque nunca vem aqui. */
export interface DriverTripView {
  id: string;
  status: TripStatus;
  passengerName: string;
  origin: TripPoint;
  destination: TripPoint;
  distanceKm: number;
  durationMinutes: number;
  distanceToPassengerKm: number | null;
  priceKz: number;
  commissionKz: number;
  netEarningsKz: number;
  paymentMethodType: string;
  boardingConfirmed: boolean;
}
