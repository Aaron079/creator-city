import { IsIn, IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator'

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  packageId!: string

  @IsString()
  @IsOptional()
  stripeSessionId?: string

  @IsIn(['CN', 'GLOBAL'])
  @IsOptional()
  region?: 'CN' | 'GLOBAL'

  @IsIn(['alipay', 'wechat', 'stripe', 'paddle', 'manual'])
  @IsOptional()
  provider?: 'alipay' | 'wechat' | 'stripe' | 'paddle' | 'manual'

  @IsString()
  @IsOptional()
  currency?: string

  @IsNumber()
  @IsOptional()
  @Min(0)
  amount?: number

  @IsString()
  @IsOptional()
  externalOrderId?: string

  @IsNumber()
  @Min(1)
  credits!: number

  @IsNumber()
  @Min(1)
  priceUSD!: number
}

export class FulfillOrderDto {
  @IsString()
  @IsOptional()
  stripeSessionId?: string

  @IsString()
  @IsOptional()
  orderId?: string

  @IsString()
  @IsOptional()
  externalOrderId?: string

  @IsString()
  @IsOptional()
  stripePaymentIntentId?: string

  @IsString()
  @IsOptional()
  externalPaymentId?: string

  @IsString()
  @IsOptional()
  rawNotifyJson?: string
}
