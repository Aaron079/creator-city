import { Module } from '@nestjs/common'
import { CityGateway } from './city.gateway'
import { JwtModule } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [CityGateway],
  exports: [CityGateway],
})
export class GatewayModule {}
