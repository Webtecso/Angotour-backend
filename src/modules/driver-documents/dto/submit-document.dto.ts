import { IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitDocumentDto {
  // Imagem em base64 (com ou sem prefixo data:). Limite ~8 MB de imagem.
  @IsString()
  @MinLength(100)
  @MaxLength(12000000)
  imageBase64: string;
}
