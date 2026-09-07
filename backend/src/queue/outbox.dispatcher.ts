import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnModuleDestroy {
	private timer?: NodeJS.Timeout;

	constructor(
		private readonly prisma: PrismaService,
		@InjectQueue('search-sync') private readonly searchQueue: Queue,
		@InjectQueue('revalidate') private readonly revalidateQueue: Queue,
		@InjectQueue('notifications') private readonly notificationsQueue: Queue,
	) {}

	onModuleInit(): void {
		this.timer = setInterval(() => {
			void this.drain();
		}, 2000);
	}

	onModuleDestroy(): void {
		if (this.timer) {
			clearInterval(this.timer);
		}
	}

	async drain(): Promise<void> {
		const events = await this.prisma.outboxEvent.findMany({
			where: { status: 'PENDING', availableAt: { lte: new Date() } },
			take: 20,
			orderBy: { createdAt: 'asc' },
		});
		for (const event of events) {
			const claimed = await this.prisma.outboxEvent.updateMany({
				where: { id: event.id, status: 'PENDING' },
				data: { status: 'PROCESSING' },
			});
			if (claimed.count !== 1) {
				continue;
			}
			try {
				// BullMQ custom job ids cannot contain ":".
				const jobId = event.idempotencyKey.replace(/:/g, '_');
				if (event.type.startsWith('search.')) {
					await this.searchQueue.add(event.type, event.payload, {
						jobId,
						removeOnComplete: true,
					});
				} else if (event.type.startsWith('page.')) {
					await this.revalidateQueue.add(event.type, event.payload, { jobId });
				} else if (event.type.startsWith('notification.')) {
					await this.notificationsQueue.add(event.type, event.payload, {
						jobId,
						removeOnComplete: true,
					});
				}
				await this.prisma.outboxEvent.update({
					where: { id: event.id },
					data: { status: 'PROCESSED', processedAt: new Date() },
				});
				await this.prisma.eventConsumerReceipt.upsert({
					where: {
						eventId_consumerName: {
							eventId: event.id,
							consumerName: 'dispatcher',
						},
					},
					update: {},
					create: { eventId: event.id, consumerName: 'dispatcher' },
				});
			} catch (error) {
				await this.prisma.outboxEvent.update({
					where: { id: event.id },
					data: {
						status: 'PENDING',
						attempts: { increment: 1 },
						lastError: error instanceof Error ? error.message : String(error),
						availableAt: new Date(Date.now() + 5000),
					},
				});
			}
		}
	}
}
