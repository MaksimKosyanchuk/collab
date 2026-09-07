import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../../logger/logger.service';
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	constructor(private readonly logger: LoggerService) {}
	catch(exception: unknown, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();
		const status =
			exception instanceof HttpException
				? exception.getStatus()
				: HttpStatus.INTERNAL_SERVER_ERROR;
		const exceptionResponse =
			exception instanceof HttpException ? exception.getResponse() : null;
		const body =
			typeof exceptionResponse === 'string'
				? { message: exceptionResponse }
				: exceptionResponse && typeof exceptionResponse === 'object'
					? (exceptionResponse as Record<string, unknown>)
					: { message: 'Internal server error' };
		if (status >= 500) {
			void this.logger.error(AllExceptionsFilter.name, 'Unhandled exception', {
				method: request.method,
				path: request.url,
				statusCode: status,
				error: exception instanceof Error ? exception.message : String(exception),
			});
		}
		response.status(status).json({
			...body,
			statusCode: status,
			path: request.url,
			timestamp: new Date().toISOString(),
			correlationId: request.headers['x-correlation-id'],
		});
	}
}
