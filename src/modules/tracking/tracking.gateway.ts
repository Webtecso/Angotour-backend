import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface DriverLocationPayload {
  tripId: string;
  driverId: string;
  latitude: number;
  longitude: number;
}

interface TripStatusPayload {
  tripId: string;
  status: string;
}

export interface TripAssignedPayload {
  tripId: string;
  originLabel: string;
  destinationLabel: string;
  distanceToPassengerKm: number;
  tripDistanceKm: number;
  tripDurationMinutes: number;
  estimatedEarningsKz: number;
  estimatedCommissionKz: number;
  paymentMethod: string;
  passengerCoordinates: { latitude: number; longitude: number };
  destinationCoordinates: { latitude: number; longitude: number };
}

/**
 * Gateway de tracking em tempo real.
 *
 * Sala por viagem (`trip:<id>`): o passageiro entra na sala da sua viagem
 * e recebe atualizacoes de localizacao do motorista e mudancas de estado.
 *
 * Sala por motorista (`driver:<id>`): o motorista entra nesta sala ao ficar
 * online, e e por ela que recebe o aviso de uma nova viagem atribuida.
 *
 * Fluxo:
 *   App passageiro  -> emit 'join_trip'        -> entra na sala trip:<id>
 *   App motorista    -> emit 'join_driver_room'  -> entra na sala driver:<id>
 *   App motorista    -> emit 'driver_location'   -> backend faz broadcast na sala da viagem
 *   Backend (trips)   -> emit 'trip_status'      -> quando o estado da viagem muda
 *   Backend (trips)   -> emit 'trip_assigned'     -> quando uma viagem e atribuida a este motorista
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    // eslint-disable-next-line no-console
    console.log(`[Socket] Cliente ligado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // eslint-disable-next-line no-console
    console.log(`[Socket] Cliente desligado: ${client.id}`);
  }

  @SubscribeMessage('join_trip')
  handleJoinTrip(@ConnectedSocket() client: Socket, @MessageBody() tripId: string) {
    client.join(`trip:${tripId}`);
  }

  @SubscribeMessage('leave_trip')
  handleLeaveTrip(@ConnectedSocket() client: Socket, @MessageBody() tripId: string) {
    client.leave(`trip:${tripId}`);
  }

  @SubscribeMessage('join_driver_room')
  handleJoinDriverRoom(@ConnectedSocket() client: Socket, @MessageBody() driverId: string) {
    client.join(`driver:${driverId}`);
  }

  @SubscribeMessage('leave_driver_room')
  handleLeaveDriverRoom(@ConnectedSocket() client: Socket, @MessageBody() driverId: string) {
    client.leave(`driver:${driverId}`);
  }

  @SubscribeMessage('driver_location')
  handleDriverLocation(@MessageBody() payload: DriverLocationPayload) {
    this.server.to(`trip:${payload.tripId}`).emit('driver_location_update', payload);
  }

  /** Chamado pelo TripsService quando o estado de uma viagem muda. */
  broadcastTripStatus(payload: TripStatusPayload) {
    this.server.to(`trip:${payload.tripId}`).emit('trip_status_update', payload);
  }

  /** Chamado pelo TripsService quando uma viagem e atribuida a um motorista. */
  notifyDriverAssigned(driverId: string, payload: TripAssignedPayload) {
    this.server.to(`driver:${driverId}`).emit('trip_assigned', payload);
  }
}
