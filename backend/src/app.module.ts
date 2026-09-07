import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { DocumentsModule } from './documents/documents.module';
import { AccessModule } from './access/access.module';
import { BillingModule } from './billing/billing.module';
import { SearchModule } from './search/search.module';
import { CommentsModule } from './comments/comments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AssetsModule } from './assets/assets.module';
import { CollabApiModule } from './collab/collab-api.module';
import { LoggerModule } from './logger/logger.module';
import { MetricsModule } from './metrics/metrics.module';
import { QueueModule } from './queue/queue.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { CorrelationInterceptor } from './common/interceptors/correlation.interceptor';

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		ThrottlerModule.forRoot({
			throttlers: [{ ttl: 60_000, limit: 120 }],
		}),
		PrismaModule,
		LoggerModule,
		MetricsModule,
		QueueModule,
		CollabApiModule,
		AccessModule,
		AuthModule,
		WorkspacesModule,
		DocumentsModule,
		BillingModule,
		SearchModule,
		CommentsModule,
		NotificationsModule,
		AssetsModule,
	],
	providers: [
		{ provide: APP_GUARD, useClass: ThrottlerGuard },
		{ provide: APP_FILTER, useClass: AllExceptionsFilter },
		{ provide: APP_INTERCEPTOR, useClass: CorrelationInterceptor },
	],
})
export class AppModule {}
