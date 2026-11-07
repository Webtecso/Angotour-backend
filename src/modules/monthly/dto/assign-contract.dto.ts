import { IsUUID } from 'class-validator';

export class AssignContractDto {
  @IsUUID()
  driverId: string;

  @IsUUID()
  vehicleId: string;
}
