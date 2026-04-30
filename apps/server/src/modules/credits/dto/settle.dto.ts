import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator'

export class SettleCreditsDto {
  @IsString()
  @IsNotEmpty()
  jobId!: string

  @IsNumber()
  @IsOptional()
  @Min(0)
  actualCost?: number
}

export class RefundCreditsDto {
  @IsString()
  @IsNotEmpty()
  jobId!: string

  @IsString()
  @IsOptional()
  reason?: string
}

export class UpdateJobExternalIdDto {
  @IsString()
  @IsNotEmpty()
  jobId!: string

  @IsString()
  @IsNotEmpty()
  externalJobId!: string
}
