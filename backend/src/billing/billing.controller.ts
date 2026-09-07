import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { BillingService } from './billing.service';
import { BillingWebhookDto, CreateCheckoutDto } from './dto/billing.dto';
@ApiTags('billing')
@Controller('billing')
export class BillingController {
	constructor(private readonly billing: BillingService) {}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Post('checkout')
	@ApiOperation({ summary: 'Create a billing checkout session' })
	checkout(
		@CurrentUser()
		user: AuthUser,
		@Body()
		dto: CreateCheckoutDto,
	) {
		return this.billing.createCheckout(user.id, dto);
	}
	@Post('webhook')
	@HttpCode(200)
	@ApiOperation({
		summary: 'Enqueue billing webhook on BullMQ (idempotent); waits for worker result',
	})
	webhook(
		@Body()
		dto: BillingWebhookDto,
	) {
		return this.billing.enqueueWebhook({
			id: dto.id,
			type: dto.type,
			data: dto.data,
		});
	}
}
