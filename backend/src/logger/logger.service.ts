import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class LoggerService {
	constructor(private readonly prisma: PrismaService) {}
	async info(
		context: string,
		message: string,
		meta?: Record<string, unknown>,
		correlationId?: string,
	): Promise<void> {
		await this.write('info', context, message, meta, correlationId);
	}
	async warn(
		context: string,
		message: string,
		meta?: Record<string, unknown>,
		correlationId?: string,
	): Promise<void> {
		await this.write('warn', context, message, meta, correlationId);
	}
	async error(
		context: string,
		message: string,
		meta?: Record<string, unknown>,
		correlationId?: string,
	): Promise<void> {
		await this.write('error', context, message, meta, correlationId);
		console.error(`[${context}] ${message}`, meta ?? {});
	}
	private async write(
		level: string,
		context: string,
		message: string,
		meta?: Record<string, unknown>,
		correlationId?: string,
	): Promise<void> {
		try {
			await this.prisma.log.create({
				data: {
					level,
					context,
					message,
					correlationId,
					meta: meta as object | undefined,
				},
			});
		} catch {
			void 0;
		}
	}
}
