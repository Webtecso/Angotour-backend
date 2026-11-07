import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class IssueProposalDto {
  @IsUUID()
  requestId: string;

  // Plano de referencia. Sem plano nem preco, usa o preco sugerido pelo motor.
  @IsOptional() @IsUUID()
  planId?: string;

  // Sem preco, usa o do plano e, sem plano, o sugerido.
  @IsOptional() @IsInt() @Min(1) @Max(100000000)
  priceKz?: number;

  // Dias de validade da proposta (por omissao 3).
  @IsOptional() @IsInt() @Min(1) @Max(30)
  validDays?: number;

  // Autoriza emitir abaixo do minimo viavel (rota subsidiada pela plataforma).
  @IsOptional() @IsBoolean()
  subsidyAuthorized?: boolean;
}
