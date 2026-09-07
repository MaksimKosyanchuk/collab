import { HttpException, HttpStatus } from '@nestjs/common';
export class PlanLimitException extends HttpException {
	constructor(resource: 'members' | 'documents' | 'storage', plan: string) {
		super(
			{
				statusCode: HttpStatus.FORBIDDEN,
				code: 'PLAN_LIMIT',
				message: `Plan ${plan} does not allow more ${resource}. Upgrade to continue.`,
				resource,
				plan,
			},
			HttpStatus.FORBIDDEN,
		);
	}
}
