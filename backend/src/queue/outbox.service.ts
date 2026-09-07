import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OutboxService {
	constructor(private readonly prisma: PrismaService) {}

	async enqueue(
		input: {
			type: string;
			aggregateType: string;
			aggregateId: string;
			idempotencyKey: string;
			payload: Prisma.InputJsonValue;
			correlationId?: string;
		},
		tx?: Prisma.TransactionClient,
	) {
		const db = tx ?? this.prisma;
		return db.outboxEvent.upsert({
			where: { idempotencyKey: input.idempotencyKey },
			update: {},
			create: {
				type: input.type,
				aggregateType: input.aggregateType,
				aggregateId: input.aggregateId,
				payload: input.payload,
				idempotencyKey: input.idempotencyKey,
				correlationId: input.correlationId,
			},
		});
	}
}
