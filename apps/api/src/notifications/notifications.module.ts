import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { NotificationService } from './notification.service';

@Module({
  controllers: [DevicesController],
  providers: [DevicesService, NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
