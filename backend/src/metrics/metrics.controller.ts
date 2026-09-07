import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { MetricsService } from './metrics.service';

@ApiTags('metrics')
@SkipThrottle()
@Controller()
export class MetricsController {
	constructor(private readonly metrics: MetricsService) {}

	@Get('metrics')
	@ApiOperation({ summary: 'Prometheus metrics scrape endpoint' })
	metricsText(): string {
		return this.metrics.render();
	}
}
