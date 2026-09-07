import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BillingController } from './billing.controller';
import { BillingWebhookProcessor } from './billing.processor';
import { BillingService } from './billing.service';

@Module({
	imports: [BullModule.registerQueue({ name: 'billing-webhook' })],
	controllers: [BillingController],
	providers: [BillingService, BillingWebhookProcessor],
})
export class BillingModule {}
