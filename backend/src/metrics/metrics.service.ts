import { Injectable } from '@nestjs/common';
@Injectable()
export class MetricsService {
	private readonly counters = new Map<string, number>();
	inc(name: string, by = 1): void {
		this.counters.set(name, (this.counters.get(name) ?? 0) + by);
	}
	render(): string {
		const lines = ['# TYPE collab_counter counter'];
		for (const [name, value] of this.counters) {
			lines.push(`${name} ${value}`);
		}
		return `${lines.join('\n')}\n`;
	}
}
