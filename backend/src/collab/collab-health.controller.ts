import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller()
export class CollabHealthController {
	@Get('health')
	health() {
		return { status: 'ok', service: 'collab' };
	}
}
