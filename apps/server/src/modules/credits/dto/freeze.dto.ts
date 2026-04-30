import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator'

export class FreezeCreditsDto {
  @IsString()
  @IsNotEmpty()
  providerId!: string

  @IsString()
  @IsNotEmpty()
  nodeType!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  prompt!: string

  @IsString()
  @IsOptional()
  externalJobId?: string
}
