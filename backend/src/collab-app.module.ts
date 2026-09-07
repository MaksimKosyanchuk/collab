import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccessModule } from './access/access.module';
import { CollabModule } from './collab/collab.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggerModule } from './logger/logger.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Dedicated collab gateway process: WebSocket /collab + Redis control plane.
 * Outbox writes land in Postgres; the API process drains them to BullMQ.
 */
@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		ThrottlerModule.forRoot({
			throttlers: [{ ttl: 60_000, limit: 120 }],
		}),
		PrismaModule,
		LoggerModule,
		AccessModule,
		CollabModule,
	],
	providers: [
		{ provide: APP_GUARD, useClass: ThrottlerGuard },
		{ provide: APP_FILTER, useClass: AllExceptionsFilter },
	],
})
export class CollabAppModule {}
