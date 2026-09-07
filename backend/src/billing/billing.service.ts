import { Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { PlanTier, Prisma } from '@prisma/client';
import { Job, Queue, QueueEvents } from 'bullmq';
import { AccessService } from '../access/access.service';
import { LoggerService } from '../logger/logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutDto } from './dto/billing.dto';
import { BillingWebhookJob } from './billing.processor';
@Injectable()
export class BillingService implements OnModuleInit, OnModuleDestroy {
	private queueEvents?: QueueEvents;
	constructor(
		private readonly prisma: PrismaService,
		private readonly access: AccessService,
		private readonly logger: LoggerService,
		private readonly config: ConfigService,
		@InjectQueue('billing-webhook')
		private readonly billingQueue: Queue,
	) {}
	async onModuleInit(): Promise<void> {
		this.queueEvents = new QueueEvents('billing-webhook', {
			connection: {
				host: this.config.get('REDIS_HOST', 'localhost'),
				port: Number(this.config.get('REDIS_PORT', 6379)),
			},
		});
		await this.queueEvents.waitUntilReady();
	}
	async onModuleDestroy(): Promise<void> {
		await this.queueEvents?.close();
	}
	async createCheckout(userId: string, dto: CreateCheckoutDto) {
		await this.access.assertWorkspaceManage(dto.workspaceId, userId);
		if (dto.plan === PlanTier.FREE) {
			return this.applyPlan(dto.workspaceId, PlanTier.FREE, null);
		}
		return this.prisma.checkoutSession.create({
			data: {
				workspaceId: dto.workspaceId,
				plan: dto.plan,
				status: 'OPEN',
			},
		});
	}
	async enqueueWebhook(payload: BillingWebhookJob) {
		let job: Job<BillingWebhookJob> | undefined;
		try {
			job = await this.billingQueue.add('webhook', payload, {
				jobId: payload.id,
				removeOnComplete: 1000,
				removeOnFail: 1000,
			});
		} catch {
			job = (await this.billingQueue.getJob(payload.id)) ?? undefined;
		}
		if (!job) {
			throw new Error(`Failed to enqueue billing webhook ${payload.id}`);
		}
		if (!this.queueEvents) {
			throw new Error('Billing queue events not ready');
		}
		const state = await job.getState();
		if (state === 'completed') {
			return job.returnvalue as {
				duplicate: boolean;
				eventId: string;
			};
		}
		if (state === 'failed') {
			throw new Error(job.failedReason ?? 'Billing webhook job failed');
		}
		return (await job.waitUntilFinished(this.queueEvents, 20000)) as {
			duplicate: boolean;
			eventId: string;
		};
	}
	async handleWebhook(
		externalId: string,
		type: string,
		data: {
			workspaceId: string;
			plan: PlanTier;
			checkoutSessionId?: string;
		},
	) {
		const existing = await this.prisma.billingEvent.findUnique({
			where: { externalId },
		});
		if (existing) {
			await this.logger.info(BillingService.name, 'Duplicate billing webhook', {
				externalId,
				type,
			});
			return { duplicate: true, eventId: existing.id };
		}
		try {
			const event = await this.prisma.$transaction(async (tx) => {
				const created = await tx.billingEvent.create({
					data: {
						externalId,
						type,
						workspaceId: data.workspaceId,
						payload: data as unknown as Prisma.InputJsonValue,
					},
				});
				if (type === 'checkout.session.completed') {
					await this.applyPlanTx(tx, data.workspaceId, data.plan, data.checkoutSessionId);
				}
				return created;
			});
			await this.logger.info(BillingService.name, 'Billing webhook processed', {
				externalId,
				type,
				plan: data.plan,
			});
			return { duplicate: false, eventId: event.id };
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
				return { duplicate: true, eventId: externalId };
			}
			throw error;
		}
	}
	private async applyPlan(workspaceId: string, plan: PlanTier, checkoutSessionId: string | null) {
		return this.prisma.$transaction((tx) =>
			this.applyPlanTx(tx, workspaceId, plan, checkoutSessionId),
		);
	}
	private async applyPlanTx(
		tx: Prisma.TransactionClient,
		workspaceId: string,
		plan: PlanTier,
		checkoutSessionId: string | null | undefined,
	) {
		const workspace = await tx.workspace.findUnique({
			where: { id: workspaceId },
		});
		if (!workspace) {
			throw new NotFoundException('Workspace not found');
		}
		await tx.workspace.update({
			where: { id: workspaceId },
			data: { plan },
		});
		await tx.subscription.upsert({
			where: { workspaceId },
			update: {
				plan,
				status: 'ACTIVE',
				currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
			},
			create: {
				workspaceId,
				plan,
				status: 'ACTIVE',
				currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
			},
		});
		if (checkoutSessionId) {
			await tx.checkoutSession.updateMany({
				where: { id: checkoutSessionId, workspaceId },
				data: { status: 'COMPLETED', completedAt: new Date() },
			});
		}
		return { workspaceId, plan };
	}
}
