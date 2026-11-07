import { Equals } from 'class-validator';

export class AcceptContractDto {
  // O passageiro tem de aceitar as condicoes de forma expressa.
  @Equals(true, { message: 'Tens de aceitar as condicoes do contrato.' })
  conditionsAccepted: boolean;
}
