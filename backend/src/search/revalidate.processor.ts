import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
type RevalidatePayload = {
	slug?: string | null;
	documentId?: string;
	tag?: string;
	path?: string;
};
@Processor('revalidate')
export class RevalidateProcessor extends WorkerHost {
	private readonly logger = new Logger(RevalidateProcessor.name);
	constructor(private readonly config: ConfigService) {
		super();
	}
	async process(job: Job<RevalidatePayload>): Promise<void> {
		const slug = job.data.slug ?? undefined;
		const tag = job.data.tag;
		const path = job.data.path;
		if (!slug && !tag && !path) {
			this.logger.warn(
				`Skip revalidate: nothing to invalidate for document ${job.data.documentId ?? '?'}`,
			);
			return;
		}
		const url =
			this.config.get<string>('NEXT_REVALIDATE_URL') ??
			'http://localhost:3000/api/revalidate';
		const secret = this.config.get<string>('REVALIDATE_SECRET') ?? '';
		if (!secret) {
			this.logger.warn(
				`REVALIDATE_SECRET missing; logged only slug=${slug ?? '-'} tag=${tag ?? '-'}`,
			);
			return;
		}
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-revalidate-secret': secret,
			},
			body: JSON.stringify({
				slug,
				documentId: job.data.documentId,
				tag,
				path,
			}),
		});
		if (!res.ok) {
			const body = await res.text();
			throw new Error(`Next revalidate failed (${res.status}): ${body}`);
		}
		this.logger.log(
			`Revalidated ${[slug && `/p/${slug}`, tag, path].filter(Boolean).join(', ')}`,
		);
	}
}
