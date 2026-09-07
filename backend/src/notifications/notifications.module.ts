import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsController } from './notifications.controller';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';

@Module({
	imports: [BullModule.registerQueue({ name: 'notifications' })],
	controllers: [NotificationsController],
	providers: [NotificationsService, NotificationsProcessor],
})
export class NotificationsModule {}
