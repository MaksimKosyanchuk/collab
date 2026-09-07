import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';
@ApiTags('notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
	constructor(private readonly notifications: NotificationsService) {}
	@Get()
	@ApiOperation({ summary: 'List notifications for current user' })
	list(
		@CurrentUser()
		user: AuthUser,
	) {
		return this.notifications.list(user.id);
	}
	@Patch(':notificationId/read')
	@ApiOperation({ summary: 'Mark a notification as read' })
	@ApiParam({ name: 'notificationId', description: 'Notification ID' })
	markRead(
		@CurrentUser()
		user: AuthUser,
		@Param('notificationId')
		notificationId: string,
	) {
		return this.notifications.markRead(user.id, notificationId);
	}
}
