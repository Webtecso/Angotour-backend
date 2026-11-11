import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const DRIVER_TOPUP_METHODS = ['multicaixa_express', 'unitel_money'];

export class CreateDriverTopUpDto {
  @IsInt()
  @Min(500)
  @Max(500000)
  amountKz: number;

  // Dinheiro vivo nao existe para motoristas. Cartao entra quando houver prestador.
  @IsOptional()
  @IsIn(DRIVER_TOPUP_METHODS)
  method?: string;
}