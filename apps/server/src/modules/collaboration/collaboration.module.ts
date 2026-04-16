import { Module } from '@nestjs/common'
import { CollaborationController } from './collaboration.controller'
import { CollaborationService } from './collaboration.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [CollaborationController],
  providers: [CollaborationService],
  exports: [CollaborationService],
})
export class CollaborationModule {}
