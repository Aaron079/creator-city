import { Module } from '@nestjs/common'
import { ShowcasesController } from './showcases.controller'
import { ShowcasesService } from './showcases.service'

@Module({
  controllers: [ShowcasesController],
  providers: [ShowcasesService],
  exports: [ShowcasesService],
})
export class ShowcasesModule {}
