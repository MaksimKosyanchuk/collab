import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PlanTier } from '@prisma/client';
import { BillingService } from './billing.service';

export type BillingWebhookJob = {
	id: string;
	type: string;
	data: {
		workspaceId: string;
		plan: PlanTier;
		checkoutSessionId?: string;
	};
};

@Processor('billing-webhook')
export class BillingWebhookProcessor extends WorkerHost {
	constructor(private readonly billing: BillingService) {
		super();
	}

	async process(job: Job<BillingWebhookJob>) {
		return this.billing.handleWebhook(job.data.id, job.data.type, job.data.data);
	}
}
