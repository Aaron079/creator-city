import { Module } from '@nestjs/common'
import { AgentRuntimeController } from './agent-runtime.controller'
import { AgentRuntimeService } from './agent-runtime.service'

@Module({
  controllers: [AgentRuntimeController],
  providers: [AgentRuntimeService],
  exports: [AgentRuntimeService],
})
export class AgentRuntimeModule {}
